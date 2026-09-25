import { expect, it } from "vitest";
import { redactErrorDetails } from "./redact-error-details";

it("preserves diagnostic codes, request ids, line breaks and non-sensitive raw errors", () => {
  const raw = 'HTTP 429\n{"error":{"code":"rate_limit_exceeded","message":"Too many requests"}}\nrequest_id=req_demo_001';
  expect(redactErrorDetails(raw)).toEqual({ text: raw, redacted: false });
});

it("hides credential headers, JSON values, URL keys and echoed tokens", () => {
  const raw = [
    'Authorization: Bearer demo-secret-one',
    'X-API-Key: demo-secret-two',
    '{"api_key":"demo-secret-three", "Authorization": "Bearer demo-secret-four", "error":"invalid_api_key"}',
    'https://llm.example.invalid/generate?key=demo-secret-five&model=demo',
    'access_token=demo-secret-six',
    'Cookie: session=demo-secret-seven; other=demo-secret-eight',
    'Incorrect key: sk-preview-not-a-real-key',
    'Connection failed with Basic ZGVtby1zZWNyZXQ='
  ].join('\n');
  const safe = redactErrorDetails(raw);
  expect(safe.redacted).toBe(true);
  expect(safe.text).not.toMatch(/demo-secret|sk-preview|ZGVtby/);
  expect(safe.text).toContain('invalid_api_key');
  expect(safe.text).toContain('&model=demo');
  expect(safe.text).not.toContain('[已隐藏]]');
  expect(redactErrorDetails(safe.text)).toEqual({ text: safe.text, redacted: false });
});

it("handles escaped JSON credential values without destroying the response body", () => {
  const raw = '{"api_key":"demo\\"secret", "error":{"code":"invalid_api_key"}}';
  expect(JSON.parse(redactErrorDetails(raw).text)).toEqual({ api_key: '[已隐藏]', error: { code: 'invalid_api_key' } });
});

it("redacts an inline Authorization scheme and token as one value", () => {
  const safe = redactErrorDetails("Proxy failure Authorization: Bearer synthetic-secret; status=500");
  expect(safe.text).toBe("Proxy failure Authorization: [已隐藏]; status=500");
  expect(redactErrorDetails(safe.text).redacted).toBe(false);
});
