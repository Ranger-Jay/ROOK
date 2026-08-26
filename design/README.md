# ROOK Design Tokens

`design/design-tokens.json` is the canonical source of truth for ROOK visual tokens. The application consumes generated CSS under `src/styles/`; there is no second token source.

## Generate

```bash
npm run tokens:generate
```

## Verify synchronization

```bash
npm run tokens:check
```

The check fails when:

- either generated CSS file differs from the canonical JSON;
- a canonical JSON token is not mapped to CSS; or
- the generator expects a token that no longer exists.

Citadel Watch v1.1 contains **153 mapped canonical tokens**, including dedicated 1080p demo roles:

- `.rook-demo-title`
- `.rook-demo-metric`
- `.rook-demo-state`
- `.rook-demo-essential`

Never edit `src/styles/tokens.css` or `src/styles/typography.css` directly.
