# Runtime compatibility bundle

This directory contains the generated, base64-split recovery archive used by `scripts/restore-runtime-bundle.cjs`.

- Regenerate it with `npm run bundle:pack`.
- Verify it with `npm run bundle:check` and `npm test`.
- Do not edit the `.b64` segments manually; update the source files, then regenerate the bundle.
