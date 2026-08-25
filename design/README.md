# Citadel Watch design tokens

`design/design-tokens.json` is the canonical machine-readable source of truth for ROOK visual tokens.

`src/styles/tokens.css` is generated from that JSON by:

```bash
node scripts/generate-tokens.mjs
```

Do not hand-edit the generated CSS. CI verifies that regeneration produces no diff.

This resolves the first-pass handoff ambiguity where CSS contained additional spacing, shadow, overlay, semantic-surface, and layout tokens not represented in the JSON source.

The semantic color laws remain unchanged:

- cyan — telemetry/intelligence;
- violet — AI orchestration;
- gold — human authority only;
- red/amber — incident/risk;
- green — evidence-backed recovery only.
