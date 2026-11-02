# Static delivery performance

## Text response compression

The Node HTTP server negotiates gzip for the page shell, shared JavaScript client, CSS, and card UI helper when the request's `Accept-Encoding` allows it.

- Compression is generated once per process and cached in memory for each static text asset.
- Files smaller than 1 KiB are not compressed.
- Responses include `Vary: Accept-Encoding` and an explicit `Content-Length`.
- Clients requesting `identity`, or explicitly setting `gzip;q=0`, receive the original bytes.
- PNG card art and WOFF2 fonts are not recompressed; they are already compressed formats.
- Server-sent events and API responses are unchanged.

The static-delivery test checks both the gzip and identity paths for the page shell, JavaScript, CSS, and card UI helper. It decompresses each gzip response and compares it byte-for-byte with the source file. This verifies correctness and payload reduction without claiming a production network benchmark.

Vercel serves the static frontend separately; this change targets the Node HTTP server used by the Render backend.
