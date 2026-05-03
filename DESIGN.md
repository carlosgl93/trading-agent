# Design System — TradingAgents

## Product Context
- **What this is:** A multi-agent LLM trading platform where AI agents (fundamental analyst, sentiment analyst, technical analyst, trader, risk manager) collaborate in real time to make trading decisions
- **Who it's for:** Active traders monitoring live positions — users who want to observe and trust their AI team, not manually configure every trade
- **Space/industry:** Fintech / algorithmic trading / AI agent platforms
- **Project type:** Real-time web dashboard (Preact + Astro)

## Aesthetic Direction
- **Direction:** Mission Control Amber — NASA mission control energy meets indie fintech. Agents feel like operators: purposeful, alive, doing real work. The user walks into a room where experts are already mid-conversation.
- **Decoration level:** Intentional — subtle amber pulse animations for agent activity states, monospace type rhythm, panel borders that glow when active. No decorative blobs, no gradient branding.
- **Mood:** Controlled urgency + trust. The system is visibly working on the user's behalf without requiring their input. Not overwhelming — legible.
- **Design anti-pattern to avoid:** Cold blue / cyan on dark blue — every crypto exchange, DeFi app, and Bloomberg clone defaults to this. TradingAgents should feel distinct.

## Typography
- **Data/prices:** JetBrains Mono 700 — engineered feel, excellent tabular-nums, numbers feel precise not decorative
- **Headers/agent callsigns:** Geist SemiBold — modern, slightly technical, readable at display sizes
- **Body/logs/debate transcript:** IBM Plex Mono 400 — terminal feed energy, comfortable at 12–13px for long-running log content
- **Labels/badges/UI:** DM Sans 500 — the one proportional font; creates deliberate visual contrast against the mono-heavy interface
- **Loading:** Google Fonts CDN — `JetBrains+Mono:wght@400;700`, `IBM+Plex+Mono:wght@400`, `Geist:wght@400;600`, `DM+Sans:wght@500`
- **Scale:**
  - xs: 10px — timestamps, secondary labels
  - sm: 12px — log lines, table data
  - base: 14px — UI labels, body
  - md: 16px — panel titles
  - lg: 20px — section headers
  - xl: 28px — current agent action (hero line)
  - 2xl: 36px — P&L delta (primary number)

## Color
- **Approach:** Restrained amber — one accent color does all the work
- **Background:** `#0B0A00` — warm near-black. Not cold blue. The warmth reads as active.
- **Surface:** `#141209` — barely-visible panel separation
- **Surface raised:** `#1C1A0F` — card/modal backgrounds
- **Border:** `#2A2618` — panel edges, subtle
- **Primary text:** `#E8E0C8` — warm off-white (not pure white, reduces eye strain)
- **Muted text:** `#6B6047` — warm brown-gray, recedes naturally
- **Accent (amber):** `#D4A820` — the primary light source; replaces cyan
- **Accent glow:** `#D4A820` at 15% opacity for borders/shadows on active elements
- **CTA/action:** `#E8673A` — hot orange, used sparingly for primary buttons only
- **Positive (gain):** `#6BCB77` — desaturated green, never used for decoration
- **Negative (loss):** `#D95050` — brick red, never used for decoration
- **Conflict badge:** `#E8673A` — hot orange, appears when agents disagree
- **Dark mode:** This IS the dark mode. Light mode is out of scope for a trading dashboard.

## Information Hierarchy
The current 3-equal-column grid hides the product's value proposition. The redesign uses a **1-2-1 weighted layout:**

- **Left column (narrow):** Command Center (trigger analysis, single ticker input) + System Status (collapsed to a compact pill strip)
- **Center column (dominant, ~50% width):** **Agent Activity Feed** — the live debate/reasoning of AI agents. This IS the product. The user should be able to answer "what is my AI team doing right now?" from 3 feet away.
- **Right column (narrow):** Portfolio snapshot + Execution log

**The hero element:** Current agent action in Geist SemiBold at 28px, top-center of the Activity Feed:
```
TRADER  ▸  EXECUTING BUY — NVDA  +47 shares
```
Everything else is context for that line.

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — trading interfaces need whitespace or they create stress
- **Scale:** 4px / 8px / 12px / 16px / 24px / 32px / 48px / 64px
- **Panel padding:** 16px (md)
- **Between panels:** 16px gap
- **Max content width:** 1280px

## Layout
- **Approach:** Weighted columns — not equal thirds
- **Grid:** Left 20% / Center 50% / Right 30% at lg breakpoint; stacked on mobile
- **Border radius:** Small = 4px, Medium = 8px, Large = 12px, Full = 9999px (pills)
- **ScoutPanel simplification:** Reduce from 5 pill-group inputs to `ticker input + Run button` as the primary affordance. Configuration options behind an expandable "Advanced" disclosure. Fewer decisions before the user can launch an analysis.

## Motion
- **Approach:** Intentional — motion communicates agent state, not decoration
- **Agent thinking:** Slow amber pulse, opacity 60% → 100% → 60%, 2.4s cycle on the agent row border
- **Agent decided:** Hard amber glow (`box-shadow: 0 0 8px #D4A82066`)
- **Agent conflict:** `CONFLICT` badge in `#E8673A`, no animation (static urgency)
- **Data row updates:** No entrance animation — live feeds with animations are visually noisy
- **State transitions:** 150ms ease-out
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`

## Agent Identity System
Each AI agent gets a visual callsign used consistently in the Activity Feed and logs:

| Agent | Callsign | Color tint |
|-------|----------|------------|
| Fundamental Analyst | `FUNDAMENTAL` | `#D4A820` (amber) |
| Sentiment Analyst | `SENTIMENT` | `#6BCB77` (green) |
| Technical Analyst | `TECHNICAL` | `#22d3ee` (cyan, retained) |
| Risk Manager | `RISK MGR` | `#D95050` (red) |
| Trader | `TRADER` | `#E8673A` (orange) |

The trader callsign is always the action line — it executes, it never just analyzes.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-03 | Amber on warm-black replaces cyan on cold-blue | Immediate visual differentiation from the trading dashboard category; warmth reads as active/alive |
| 2026-05-03 | Agent Activity Feed as center column hero | The value prop ("AI agents collaborating") should be immediately legible, not buried in execution logs |
| 2026-05-03 | ScoutPanel simplified to ticker + button primary | Reduces friction for the primary action; advanced options behind disclosure |
| 2026-05-03 | JetBrains Mono replaces system-ui for data | system-ui has no personality; JetBrains Mono reads as engineered precision |
| 2026-05-03 | No decorative animations on live data rows | Live feed + entrance animations = visual noise; motion reserved for agent state only |
| 2026-05-03 | Initial design system created | Created by /design-consultation based on codebase analysis, competitive research (EUREKA: "collaboration theater not data firehose"), and Claude subagent outside voice |
