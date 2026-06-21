---
name: TradingAgents
last_updated: 2026-06-20
---

# TradingAgents Strategy

## Target problem

El inversionista retail aspiracional entiende lo básico de invertir, pero se paraliza antes de ejecutar una decisión de compra/venta sobre un ticker (acción o ETF). El análisis que encuentra hoy — redes sociales, noticias, broker — es disperso, opaco y no estructurado, así que decide por intuición o no decide.

## Our approach

Entregar **un veredicto único accionable** (compra/venta/mantén) respaldado por un **journey auditable de múltiples agentes analistas**. El usuario ve el proceso completo: puede hacer drill-down en cada agente, leer su razonamiento, y trazar cómo se construyó la decisión final. La apuesta combina decisión clara + transparencia total — algo que ni Reddit, ni un solo LLM, ni un robo-advisor entregan juntos.

## Who it's for

**Primary:** Inversionista retail aspiracional — alguien que entiende lo básico pero no tiene la confianza para ejecutar. Está contratando al producto para obtener un veredicto auditable sobre un ticker y actuar (o explícitamente no actuar) con fundamento.

## Key metrics

- **Paper portfolio P&L vs benchmark** — outcome lagging. Mide si los verdicts del producto realmente le ganan al mercado. Vivirá en Alpaca paper trading account.
- **% de usuarios que vuelven en X días** — retention. Mide si el producto genera valor recurrente, no curiosidad de una vez.
- **% de usuarios que drill-down en ≥1 agente** — engagement con la transparencia. Valida que el journey auditable es la pieza que importa, no solo el veredicto.

## Tracks

### Hosting & multi-tenancy

Sacar el producto de local, deploy en free-tier (Firebase u otro), separar estado por usuario.

_Why it serves the approach:_ Sin hosting accesible no hay POC para mostrar a inversionistas, ni base para multi-tenancy.

### Paper trading execution & feedback loop

Ejecutar verdicts en Alpaca paper, trackear P&L vs benchmark, surfacear resultados al usuario.

_Why it serves the approach:_ Cierra el loop outcome. Sin ejecución y medición real, la calidad del veredicto es solo opinión.

### Verdict + journey UI

Construir la visualización del journey de agentes, drill-down en cada analista, veredicto único accionable al final.

_Why it serves the approach:_ Es la manifestación visible de la apuesta central. Si la UI no transmite transparencia + decisión, la promesa muere.

## Not working on

- **Mejora profunda del pipeline multi-agente** — los agentes actuales son suficientes para la POC. Invertir en calidad del debate / nuevos roles / mejor síntesis se difiere a post-POC, cuando haya datos reales de qué falla.