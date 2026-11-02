'use strict';
const original=globalThis.fetch;
globalThis.fetch=(url,options)=>original(String(url).replace('https://example.test',process.env.TEST_REST_ORIGIN),options);
