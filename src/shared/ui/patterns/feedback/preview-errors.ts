import type { InlineFeedbackProps } from "./types";

/** Synthetic responses for Storybook only. Never sends a request. */
export const previewErrors = {
  limited: {
    message: "AI 服务请求过于频繁，请稍后重试。",
    details: {
      id: "preview-rate-limit", status: 429, code: "rate_limit_exceeded", requestId: "req_demo_001",
      raw: 'HTTP 429 Too Many Requests\n\n{\n  "error": {\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded",\n    "message": "Request rate exceeded. Please retry after 30 seconds.",\n    "retry_after": 30\n  }\n}'
    }
  },
  auth: {
    message: "AI 服务认证失败，请检查 API 配置。",
    details: {
      id: "preview-auth", status: 401, code: "invalid_api_key", requestId: "req_demo_002",
      raw: 'HTTP 401 Unauthorized\n\n{\n  "error": {\n    "code": "invalid_api_key",\n    "message": "The supplied API key sk-preview-not-a-real-key was rejected."\n  }\n}'
    }
  },
  timeout: {
    message: "AI 服务连接超时，请检查网络后重试。",
    details: {
      id: "preview-timeout", code: "ETIMEDOUT",
      raw: 'TimeoutError: The request timed out after 30000ms.\n\nEndpoint: https://llm.example.invalid/v1/generate\nCause: No response was received before the request deadline.\n\nNo HTTP response body is available. The connection may have been interrupted by the network, a proxy, or the remote service.'
    }
  }
} satisfies Record<string, Pick<InlineFeedbackProps, "message" | "details">>;
