"""Autonomous scout task: macro-to-micro ticker discovery (Strategy C).

Pipeline
--------
1. Fetch sector ETF 5-day / 1-month returns (SPDR family + SPY benchmark)
2. Fetch recent macro / global news headlines
3. Single LLM call with structured output → list of high-conviction picks
4. Filter: drop open positions, enforce min conviction
5. Chain picks into the existing analyze_and_trade Celery sequence
6. Persist results to scouting_log for traceability

The scout runs automatically at 9:00 AM ET Mon–Fri (Beat schedule) and can
be triggered manually via POST /scout.
"""

import json
import os
import re
from datetime import date
from typing import List, Optional

from celery.utils.log import get_task_logger
from pydantic import BaseModel

from backend.celery_app import celery_app
from backend.db import get_open_positions, log_scouting
from backend.tasks import _get_model_list

logger = get_task_logger(__name__)

# ---------------------------------------------------------------------------
# Customization guidance injected into the scout prompt
# ---------------------------------------------------------------------------

_RISK_CONVICTION = {"conservative": 4, "moderate": 3, "aggressive": 2}

_RISK_GUIDANCE = {
    "conservative": (
        "Risk profile: CONSERVATIVE. Prefer established S&P 500 large-caps with strong "
        "balance sheets, stable earnings, and low volatility (beta < 1.2). Avoid speculative, "
        "pre-revenue, or highly leveraged names."
    ),
    "moderate": (
        "Risk profile: MODERATE. Balance growth potential with risk management. "
        "Mix of large-caps and quality growth names; acceptable beta up to 1.5."
    ),
    "aggressive": (
        "Risk profile: AGGRESSIVE. Prioritize high-growth, high-momentum names. "
        "Accept higher volatility for outsized return potential. Can include smaller "
        "S&P 500 / Nasdaq 100 names with strong near-term catalysts."
    ),
}

_HORIZON_GUIDANCE = {
    "short": (
        "Time horizon: SHORT-TERM (1–4 weeks). Focus on imminent catalysts: upcoming earnings, "
        "FDA decisions, product launches, or technical breakout setups."
    ),
    "medium": (
        "Time horizon: MEDIUM-TERM (1–3 months). Sector rotation plays, earnings recovery "
        "stories, and macro theme beneficiaries with visible near-term catalysts."
    ),
    "long": (
        "Time horizon: LONG-TERM (6–12 months). Structural secular trends, valuation "
        "re-ratings, and companies with durable competitive moats."
    ),
}

_STYLE_GUIDANCE = {
    "growth": (
        "Investment style: GROWTH. Prioritize companies with revenue/EPS growth >20% YoY "
        "and expanding margins. Valuation secondary to growth trajectory."
    ),
    "value": (
        "Investment style: VALUE. Seek undervalued names with low P/E or P/S relative to "
        "sector peers or their own 5-year historical range."
    ),
    "momentum": (
        "Investment style: MOMENTUM. Favor stocks with strong price momentum "
        "(52-week relative strength vs. sector) and rising earnings revisions."
    ),
    "quality": (
        "Investment style: QUALITY. Emphasize high ROE, low debt-to-equity, "
        "consistent free cash flow, and durable competitive advantages."
    ),
    "any": "",
}

# SPDR sector ETFs → sector name (sorted by broad coverage)
SECTOR_ETFS = {
    "Technology": "XLK",
    "Financials": "XLF",
    "Healthcare": "XLV",
    "Energy": "XLE",
    "Industrials": "XLI",
    "Consumer Discretionary": "XLY",
    "Communication Services": "XLC",
    "Utilities": "XLU",
    "Materials": "XLB",
    "Real Estate": "XLRE",
    "Consumer Staples": "XLP",
}


# ---------------------------------------------------------------------------
# Pydantic schemas for structured LLM output
# ---------------------------------------------------------------------------

class ScoutedTicker(BaseModel):
    ticker: str
    sector: str
    thesis: str
    conviction: int  # 1–5


class ScoutResult(BaseModel):
    macro_context: str  # 2-3 sentence macro regime summary
    tickers: List[ScoutedTicker]


# ---------------------------------------------------------------------------
# Data fetchers
# ---------------------------------------------------------------------------

def _fetch_sector_snapshot() -> str:
    """Return a ranked text table of sector ETF performance vs SPY."""
    import yfinance as yf

    symbols = list(SECTOR_ETFS.values()) + ["SPY"]
    try:
        raw = yf.download(symbols, period="1mo", auto_adjust=True, progress=False)
        data = raw["Close"] if "Close" in raw.columns.get_level_values(0) else raw
    except Exception as exc:
        logger.warning("[SCOUT] Sector fetch failed: %s", exc)
        return "Sector performance data unavailable."

    if data.empty or len(data) < 5:
        return "Sector performance data unavailable (insufficient history)."

    try:
        spy_5d = (data["SPY"].iloc[-1] / data["SPY"].iloc[-5] - 1) * 100
        spy_1m = (data["SPY"].iloc[-1] / data["SPY"].iloc[0] - 1) * 100
    except Exception:
        return "Sector performance data unavailable (SPY price missing)."

    lines = [f"SPY (S&P 500): 5d={spy_5d:+.1f}%, 1m={spy_1m:+.1f}%", ""]
    rows = []
    for sector, etf in SECTOR_ETFS.items():
        if etf not in data.columns:
            continue
        try:
            p5 = (data[etf].iloc[-1] / data[etf].iloc[-5] - 1) * 100
            p1m = (data[etf].iloc[-1] / data[etf].iloc[0] - 1) * 100
            vs_spy = p5 - spy_5d
            rows.append((sector, etf, p5, p1m, vs_spy))
        except Exception:
            continue

    rows.sort(key=lambda x: x[4], reverse=True)  # best vs SPY first
    for sector, etf, p5, p1m, vs in rows:
        lines.append(
            f"{sector} ({etf}): 5d={p5:+.1f}% ({vs:+.1f}% vs SPY), 1m={p1m:+.1f}%"
        )
    return "\n".join(lines)


def _fetch_macro_news(today: str) -> str:
    """Fetch recent global/macro news via the existing news vendor."""
    try:
        from tradingagents.dataflows.config import set_config
        from tradingagents.default_config import DEFAULT_CONFIG
        set_config(DEFAULT_CONFIG)
        from tradingagents.agents.utils.news_data_tools import get_global_news
        return get_global_news.invoke({"curr_date": today, "look_back_days": 3, "limit": 8})
    except Exception as exc:
        logger.warning("[SCOUT] Macro news fetch failed: %s", exc)
        return "Macro news unavailable."


# ---------------------------------------------------------------------------
# LLM helpers
# ---------------------------------------------------------------------------

def _build_llm(model: str):
    """Build a lightweight LLM client without a full TradingAgentsGraph."""
    from tradingagents.llm_clients import create_llm_client
    if model.startswith("minimax/"):
        return create_llm_client(
            provider="minimax",
            model=model.split("/", 1)[1],
            extra_body={"reasoning_split": True},
        ).get_llm()
    headers = {
        "HTTP-Referer": os.environ.get("SITE_URL", "http://localhost:4321"),
        "X-Title": os.environ.get("OPENROUTER_SITE_NAME", "TradingAgents POC"),
    }
    return create_llm_client(
        provider="openrouter",
        model=model,
        default_headers=headers,
    ).get_llm()


def _invoke_structured(llm, prompt: str, use_structured: bool = True) -> Optional[ScoutResult]:
    """Try structured output; fall back to free-text JSON parsing on failure."""
    if use_structured:
        try:
            result = llm.with_structured_output(ScoutResult).invoke(prompt)
            if result is not None:
                return result
            logger.warning("[SCOUT] Structured output returned None — falling back to free text")
        except Exception as exc:
            exc_str = str(exc)
            logger.warning("[SCOUT] Structured output raised: %s | falling back to free text", exc_str[:200])

    fallback_prompt = (
        prompt
        + "\n\nRespond ONLY with valid JSON (no markdown fences) matching:\n"
        + '{"macro_context":"...","tickers":[{"ticker":"XYZ","sector":"...","thesis":"...","conviction":4}]}'
    )
    raw = llm.invoke(fallback_prompt).content
    raw = re.sub(r"```(?:json)?", "", raw).strip().strip("`").strip()
    try:
        return ScoutResult(**json.loads(raw))
    except Exception as parse_exc:
        logger.error("[SCOUT] Free-text parse failed: %s | raw=%.300s", parse_exc, raw)
        return None


# ---------------------------------------------------------------------------
# Celery task
# ---------------------------------------------------------------------------

@celery_app.task(
    bind=True,
    max_retries=3,
    name="backend.scout_task.scout_tickers",
    queue="analysis",
)
def scout_tickers(
    self,
    paid: bool = True,
    max_picks: int = 1,
    min_conviction: Optional[int] = None,
    risk_level: str = "moderate",
    focus_sectors: Optional[List[str]] = None,
    time_horizon: str = "medium",
    style: str = "any",
    _model_index: int = 0,
):
    """Macro-to-micro autonomous scout. Picks tickers then chains analyze_and_trade."""
    today = str(date.today())
    models = _get_model_list(paid)
    model = models[_model_index % len(models)]

    # Derive min_conviction from risk_level if not explicitly set
    if min_conviction is None:
        min_conviction = _RISK_CONVICTION.get(risk_level, 3)

    logger.info(
        "[SCOUT] Starting | model=%s | paid=%s | max_picks=%d | min_conviction=%d "
        "| risk=%s | horizon=%s | style=%s | sectors=%s",
        model, paid, max_picks, min_conviction,
        risk_level, time_horizon, style,
        focus_sectors or "all",
    )

    try:
        sector_snapshot = _fetch_sector_snapshot()
        macro_news = _fetch_macro_news(today)
        open_tickers = {p["ticker"] for p in get_open_positions()}

        # Build customization block
        guidance_lines = []
        if risk_line := _RISK_GUIDANCE.get(risk_level):
            guidance_lines.append(risk_line)
        if horizon_line := _HORIZON_GUIDANCE.get(time_horizon):
            guidance_lines.append(horizon_line)
        if style_line := _STYLE_GUIDANCE.get(style, ""):
            guidance_lines.append(style_line)
        if focus_sectors:
            guidance_lines.append(
                f"Sector focus: analyze ONLY stocks from these sectors: "
                f"{', '.join(focus_sectors)}. Ignore all other sectors."
            )
        customization_block = "\n".join(f"- {line}" for line in guidance_lines)

        prompt = f"""You are a macro-driven equity strategist. Today is {today}.

== SECTOR PERFORMANCE (SPDR ETFs, ranked by 5-day alpha vs SPY) ==
{sector_snapshot}

== RECENT MACRO & GLOBAL NEWS ==
{macro_news}

== INVESTMENT CONSTRAINTS ==
{customization_block if customization_block else "- No specific constraints; apply balanced judgment."}

== TASK ==
Identify up to {max_picks} high-conviction US stock picks using macro-to-micro reasoning:
  1. Assess the current macro regime (growth, rates, risk sentiment)
  2. Identify the 2-3 sectors best positioned given the constraints above
  3. Pick 1-2 specific stocks per sector with clear catalysts matching the time horizon

Rules:
- Assign conviction 1–5; only include stocks with conviction >= {min_conviction}
- Prefer liquid S&P 500 / Nasdaq 100 names
- Exclude these tickers already held: {sorted(open_tickers) if open_tickers else "none"}
- Keep each thesis to 2-3 sentences maximum

== OUTPUT STYLE: CAVEMAN ==
You terse. Output short. No prose between sections.
- Return JSON only. No preamble, no closing remarks.
- Each pick: ticker, conviction (int 1-5), thesis (1 sentence max, no fluff).
- 3 lines per pick. Done.
"""

        llm = _build_llm(model)
        # MiniMax's tool-calling path returns None silently; use free-text directly.
        use_structured = not model.startswith("minimax/")
        result = _invoke_structured(llm, prompt, use_structured=use_structured)

        if result is None:
            logger.error("[SCOUT] LLM returned no usable result — aborting")
            return {"error": "no_result", "model": model}

        picks = [
            t for t in result.tickers
            if t.conviction >= min_conviction
            and t.ticker.upper() not in open_tickers
        ][:max_picks]

        logger.info(
            "[SCOUT] Macro: %s | Picks: %s",
            result.macro_context[:120],
            [(p.ticker, p.conviction) for p in picks],
        )

        log_scouting(
            scout_date=today,
            macro_context=result.macro_context,
            picks=[p.model_dump() for p in picks],
            model_used=model,
        )

        if picks:
            from celery import chain as celery_chain
            from backend.tasks import analyze_and_trade
            tickers = [p.ticker.upper() for p in picks]
            steps = celery_chain(*[
                analyze_and_trade.si(t, today, _seq_pos=i, _seq_tickers=tickers, paid=paid)
                for i, t in enumerate(tickers)
            ])
            steps.delay()
            logger.info("[SCOUT] Analysis chain queued: %s", tickers)

        return {
            "model": model,
            "macro_context": result.macro_context,
            "picks": [p.model_dump() for p in picks],
            "skipped_open": sorted(open_tickers),
        }

    except Exception as exc:
        exc_str = str(exc)
        is_retryable = any(t in exc_str for t in (
            "429", "rate_limit", "too many requests",
            "400", "404", "502", "503", "524",
            "overloaded", "unavailable", "timeout",
            "reasoning_content", "ConnectError",
            "Temporary failure in name resolution",
        )) or isinstance(exc, (OSError, ConnectionError))

        if is_retryable:
            next_index = _model_index + 1
            next_model = models[next_index % len(models)]
            full_cycles = next_index // len(models)
            backoff = 60 * (2 ** (full_cycles - 1)) if full_cycles > 0 else 15
            logger.warning(
                "[SCOUT] Retryable error on %s — switching to %s (backoff=%ds): %s",
                model, next_model, backoff, exc_str[:120],
            )
            raise self.retry(
                exc=exc,
                countdown=backoff,
                kwargs={
                    "paid": paid,
                    "max_picks": max_picks,
                    "min_conviction": min_conviction,
                    "risk_level": risk_level,
                    "focus_sectors": focus_sectors,
                    "time_horizon": time_horizon,
                    "style": style,
                    "_model_index": next_index,
                },
            )

        logger.error("[SCOUT] Fatal: %s", exc, exc_info=True)
        raise
