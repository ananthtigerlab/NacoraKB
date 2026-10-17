# Pending — diagrams that need LLM regeneration

Last checked **2026-08-11** — all clear.

```
102 diagrams checked · 102 ok · 0 broken
```

Nothing outstanding. Editable, hand-drawn Excalidraw diagrams on every page (1 diagram per KB page, 102 pages total).

> Count shrank from 111 → 102 between 2026-07-05 and 2026-08-11 as some pages were consolidated. Diagram count now matches page count 1:1.

## If diagrams break again in future

1. `npm run dev`
2. `npx tsx scripts/audit-diagrams.ts` — real-parser sweep, shows count of broken diagrams
3. If any broken:
   - `npx tsx scripts/repair-diagrams-local.ts` — rule-based fixes (no API cost)
   - `npx tsx scripts/repair-diagrams.ts` — LLM regeneration for whatever local rules can't handle

## Provider state

- `LLM_PROVIDER=gemini` in `.env` — active
- Anthropic key is still in `.env` as a fallback; switch by editing that line
