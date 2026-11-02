# Runtime compatibility bundle

This directory contains the generated, base64-split recovery archive used by `scripts/restore-runtime-bundle.cjs`.

- Regenerate it with `npm run bundle:pack`.
- Verify it with `npm run bundle:check` and `npm test`.
- Do not edit the `.b64` segments manually; update the source files, then regenerate the bundle.

The archive intentionally retains `public/index.html` and `public/style.css` for compatibility with the older Render recovery path and its parity tests. They are not the active frontend shell or stylesheet: the current server and Vercel build use `ui/index.html` and `ui/style.css`.
