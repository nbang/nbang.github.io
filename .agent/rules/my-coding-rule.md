---
trigger: always_on
glob: "**/*"
description: "Core project rules for nbang.github.io"
---

# Project Rules (`nbang.github.io`)

1. **No Build Step**: Pure HTML/JS/Tailwind(CDN).
2. **Linting**: Always run `npm run lint:fix` to sort Tailwind classes and format code.
3. **Architecture**: 
   - Privacy-first client-side processing (WASM/WebGPU).
   - "Side-car" data files for dashboards.
4. **Navigation**: New tools must be added to `index.html`.
5. **Reference**: See `speckit/DEVELOPER_HANDOVER.md` for full details.
