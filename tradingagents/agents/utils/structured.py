"""Shared helpers for invoking an agent with structured output and a graceful fallback.

The Portfolio Manager, Trader, and Research Manager all follow the same
canonical pattern:

1. At agent creation, wrap the LLM with ``with_structured_output(Schema)``
   so the model returns a typed Pydantic instance. If the provider does
   not support structured output (rare; mostly older Ollama models), the
   wrap is skipped and the agent uses free-text generation instead.
2. At invocation, run the structured call and render the result back to
   markdown. If the structured call itself fails for any reason
   (malformed JSON from a weak model, transient provider issue), fall
   back to a plain ``llm.invoke`` so the pipeline never blocks.

Centralising the pattern here keeps the agent factories small and ensures
all three agents log the same warnings when fallback fires.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional, TypeVar

from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


# Providers whose ``with_structured_output`` call silently hangs or returns
# ``None`` instead of raising.  For these we skip the binding entirely and
# rely on the free-text fallback path, which uses ``llm.invoke(prompt)``
# directly.  Detection is by the canonical ``model_name`` prefix used in
# ``PAID_MODELS`` (``minimax/MiniMax-M3`` etc.) — see
# ``memory/minimax-m3-integration-2026-06.md`` for the original incident.
_STRUCTURED_OUTPUT_SKIP_PREFIXES = ("minimax/",)


def _should_skip_structured_output(llm: Any) -> bool:
    """Return True if this LLM's provider does not support structured output.

    Uses ``str(getattr(...))`` rather than a direct ``startswith`` call so
    that unittest ``MagicMock`` objects (whose attribute access returns
    another MagicMock) do not accidentally match the prefix.
    """
    model_name = str(getattr(llm, "model_name", "") or "")
    return any(model_name.startswith(p) for p in _STRUCTURED_OUTPUT_SKIP_PREFIXES)


def bind_structured(llm: Any, schema: type[T], agent_name: str) -> Optional[Any]:
    """Return ``llm.with_structured_output(schema)`` or ``None`` if unsupported.

    Returns ``None`` (no binding attempted) for providers on the
    ``_STRUCTURED_OUTPUT_SKIP_PREFIXES`` skip-list — these providers hang
    or return ``None`` silently when asked to use tool-calling structured
    output, so we go straight to free-text generation.

    For all other providers, attempts the binding and returns ``None`` if
    the binding itself raises ``NotImplementedError`` or ``AttributeError``,
    again logging a warning so the user understands the agent will use
    free-text generation for every call instead of one-shot fallback.
    """
    if _should_skip_structured_output(llm):
        logger.warning(
            "%s: provider model '%s' is on the structured-output skip-list; "
            "using free-text generation for every call",
            agent_name, getattr(llm, "model_name", "<unknown>"),
        )
        return None

    try:
        return llm.with_structured_output(schema)
    except (NotImplementedError, AttributeError) as exc:
        logger.warning(
            "%s: provider does not support with_structured_output (%s); "
            "falling back to free-text generation",
            agent_name, exc,
        )
        return None


def invoke_structured_or_freetext(
    structured_llm: Optional[Any],
    plain_llm: Any,
    prompt: Any,
    render: Callable[[T], str],
    agent_name: str,
) -> str:
    """Run the structured call and render to markdown; fall back to free-text on any failure.

    ``prompt`` is whatever the underlying LLM accepts (a string for chat
    invocations, a list of message dicts for chat models that take that
    shape). The same value is forwarded to the free-text path so the
    fallback sees the same input the structured call did.
    """
    if structured_llm is not None:
        try:
            result = structured_llm.invoke(prompt)
            return render(result)
        except Exception as exc:
            logger.warning(
                "%s: structured-output invocation failed (%s); retrying once as free text",
                agent_name, exc,
            )

    response = plain_llm.invoke(prompt)
    return response.content
