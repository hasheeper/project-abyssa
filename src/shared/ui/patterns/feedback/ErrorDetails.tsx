import { useId, type ReactNode } from "react";
import type { FeedbackErrorDetails } from "./types";
import { redactErrorDetails } from "./redact-error-details";

/** Native disclosure keeps Enter/Space, focus and collapsed content semantics. */
export function ErrorDetails({ details, children }: { details: FeedbackErrorDetails; children?: ReactNode }) {
  const regionId = useId();
  const raw = redactErrorDetails(details.raw);
  const code = redactErrorDetails(details.code ?? "");
  const request = redactErrorDetails(details.requestId ?? "");
  const redacted = raw.redacted || code.redacted || request.redacted;
  return <details className="scene-feedback__details">
    <summary aria-controls={regionId}>
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m5 3 5 5-5 5" /></svg>
      <span className="scene-feedback__details-closed">详细原因</span>
      <span className="scene-feedback__details-open">收起详情</span>
    </summary>
    <div className="scene-feedback__diagnostics" id={regionId}>
      {(details.status != null || code.text) && <div className="scene-feedback__error-meta">
        {details.status != null && <span className="scene-feedback__http-status">HTTP {details.status}</span>}
        {code.text && <code>{code.text}</code>}
      </div>}
      <pre className="scene-feedback__raw-error" tabIndex={0} role="region" aria-label="原始错误信息"><code>{raw.text}</code></pre>
      {(request.text || redacted) && <div className="scene-feedback__error-footnote">
        {request.text && <span>请求 ID <code>{request.text}</code></span>}
        {redacted && <span>凭据已隐藏</span>}
      </div>}
      {children}
    </div>
  </details>;
}
