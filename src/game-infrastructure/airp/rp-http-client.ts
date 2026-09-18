import { airpInteraction, airpOpaqueId, parseAirpReceipt, type AirpInteractionReceipt, type AirpRpBinding, type AirpSceneResult } from "../../game-application/airp/contracts";
import { parseAirpSceneTicket, type AirpSceneTicket } from "../../game-application/airp/acceptance";
import { decodeAirpNativeResult, inspectAirpControlTimelinePage, inspectAirpTimelinePage } from "../../game-application/airp/rp-wire";
import { airpControlInteraction, parseAirpControlTicket, type AirpControlTicket } from "../../game-application/airp/control";
import { airpSessionInput, decodeAirpFreshSession, decodeAirpRelease, findAirpSessionCandidates, parseAirpSessionTicket, verifyAirpBranchContext, verifyAirpFreshBranch, type AirpReleaseTarget, type AirpSessionTicket } from "../../game-application/airp/rp-session";

export class AirpHttpError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean, public readonly outcomeUnknown: boolean) {
    super(code);
    this.name = "AirpHttpError";
  }
}

/** Transport only: no model selection, prompts, workflow loop, credentials or local persistence. */
export function createAirpRpHttpClient(options: { baseUrl: string; fetch?: typeof fetch; timeoutMs?: number; maxResponseBytes?: number }) {
  const base = new URL(options.baseUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash || !base.pathname.replace(/\/$/, "").endsWith("/api/v1"))
    throw new Error("AIRP baseUrl must be an application API URL without embedded credentials");
  const root = base.href.replace(/\/$/, ""), transport = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 300_000, maxBytes = options.maxResponseBytes ?? 2 * 1024 * 1024;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || !Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Invalid AIRP transport limits");

  async function json(path: string, body: unknown | undefined, signal: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await transport(`${root}${path}`, {
        method: body === undefined ? "GET" : "POST", signal,
        credentials: "omit", redirect: "error", cache: "no-store",
        headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new AirpHttpError(signal.aborted ? "AIRP_REQUEST_ABORTED" : "AIRP_NETWORK_ERROR", true, body !== undefined); }
    if (!response.body) throw new AirpHttpError("AIRP_EMPTY_RESPONSE", false, body !== undefined);
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, buffer = "";
    try {
      while (true) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > maxBytes) { await reader.cancel(); throw new AirpHttpError("AIRP_RESPONSE_TOO_LARGE", false, body !== undefined); }
        buffer += decoder.decode(part.value, { stream: true });
      }
      buffer += decoder.decode();
    } catch (e) {
      if (e instanceof AirpHttpError) throw e;
      throw new AirpHttpError(signal.aborted ? "AIRP_REQUEST_ABORTED" : "AIRP_NETWORK_ERROR", true, body !== undefined);
    } finally { reader.releaseLock(); }
    let envelope: { data?: unknown; error?: { code?: unknown; retryable?: unknown } };
    try { envelope = JSON.parse(buffer); } catch { throw new AirpHttpError("AIRP_INVALID_RESPONSE", false, body !== undefined); }
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new AirpHttpError("AIRP_INVALID_RESPONSE", false, body !== undefined);
    if (!response.ok) {
      // Do not show arbitrary server/provider messages, request bodies or credentials in UI errors.
      const code = typeof envelope.error?.code === "string" && /^[A-Z][A-Z0-9_]{0,100}$/.test(envelope.error.code) ? envelope.error.code : "AIRP_HTTP_ERROR";
      throw new AirpHttpError(code, envelope.error?.retryable === true, body !== undefined && response.status >= 500);
    }
    if (!Object.hasOwn(envelope, "data") || envelope.error) throw new AirpHttpError("AIRP_INVALID_RESPONSE", false, body !== undefined);
    return envelope.data;
  }

  async function bounded<T>(external: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController(), abort = () => controller.abort();
    if (external?.aborted) abort(); else external?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, timeoutMs);
    try { return await run(controller.signal); }
    finally { clearTimeout(timeout); external?.removeEventListener("abort", abort); }
  }

  async function visit<T>(binding: AirpRpBinding, signal: AbortSignal, inspect: (raw: unknown) => { value: T | null; nextCursor: number | null }): Promise<T> {
    const path = `/conversation-threads/${encodeURIComponent(binding.threadId)}/timeline`;
    const cursors = new Set<number>();
    let cursor: number | null = null;
    for (let page = 0; page < 256; page++) {
      const query = new URLSearchParams({ branchId: binding.branchId, limit: "50" });
      if (cursor !== null) query.set("cursor", String(cursor));
      const inspected = inspect(await json(`${path}?${query}`, undefined, signal));
      if (inspected.value !== null) return inspected.value;
      cursor = inspected.nextCursor;
      if (cursor === null) throw new AirpHttpError("AIRP_FLOOR_NOT_FOUND", false, false);
      if (cursors.has(cursor)) throw new AirpHttpError("AIRP_INVALID_CURSOR", false, false);
      cursors.add(cursor);
    }
    throw new AirpHttpError("AIRP_TIMELINE_BUDGET", false, false);
  }

  async function read(ticket: AirpSceneTicket, receipt: AirpInteractionReceipt, signal: AbortSignal): Promise<AirpSceneResult> {
    const output = await visit(ticket.binding, signal, raw => {
      const page = inspectAirpTimelinePage(raw, ticket, receipt);
      return { value: page.output, nextCursor: page.nextCursor };
    });
    return decodeAirpNativeResult(await json(`/runs/${encodeURIComponent(output.runId)}/result`, undefined, signal), ticket, receipt, output);
  }

  async function readControl(ticket: AirpControlTicket, receipt: AirpInteractionReceipt, signal: AbortSignal): Promise<AirpInteractionReceipt> {
    await visit(ticket.binding, signal, raw => {
      const page = inspectAirpControlTimelinePage(raw, ticket, receipt);
      return { value: page.committed ? true : null, nextCursor: page.nextCursor };
    });
    return receipt;
  }
  async function afterSubmission<T>(run: () => Promise<T>): Promise<T> {
    try { return await run(); }
    catch (error) {
      // A failed follow-up GET cannot undo the preceding POST. Replay its stable ticket.
      if (error instanceof AirpHttpError) throw new AirpHttpError(error.code, error.retryable, true);
      throw error;
    }
  }
  async function freshSession(ticket: AirpSessionTicket, detail: unknown, signal: AbortSignal): Promise<AirpRpBinding> {
    const binding = decodeAirpFreshSession(detail, ticket), path = `/conversation-threads/${encodeURIComponent(binding.threadId)}/branches`;
    verifyAirpFreshBranch(await json(path, undefined, signal), binding);
    verifyAirpBranchContext(await json(`${path}/${encodeURIComponent(binding.branchId)}/context`, undefined, signal), binding, ticket.target);
    return binding;
  }
  async function recoverSession(ticket: AirpSessionTicket, signal: AbortSignal): Promise<AirpRpBinding | null> {
    const candidates = findAirpSessionCandidates(await json("/sessions", undefined, signal), ticket);
    if (candidates.length > 1) throw new AirpHttpError("AIRP_SESSION_AMBIGUOUS", false, false);
    if (!candidates.length) return null;
    return freshSession(ticket, await json(`/sessions/${encodeURIComponent(candidates[0])}`, undefined, signal), signal);
  }

  return {
    release(releaseId: string, signal?: AbortSignal): Promise<AirpReleaseTarget> {
      airpOpaqueId(releaseId, "releaseId");
      return bounded(signal, async local => decodeAirpRelease(await json(`/releases/${encodeURIComponent(releaseId)}`, undefined, local), releaseId));
    },
    /** Persist ticket first. Native creation is NOT idempotent. Recover exact metadata, never title/latest; ambiguous recovery fails closed. Caller must serialize creation across tabs. */
    createSession(raw: AirpSessionTicket, signal?: AbortSignal): Promise<AirpRpBinding> {
      const ticket = parseAirpSessionTicket(raw);
      return bounded(signal, async local => {
        const recovered = await recoverSession(ticket, local);
        if (recovered) return recovered;
        const detail = await json("/sessions", airpSessionInput(ticket), local);
        return afterSubmission(() => freshSession(ticket, detail, local));
      });
    },
    recoverSession(raw: AirpSessionTicket, signal?: AbortSignal): Promise<AirpRpBinding | null> {
      const ticket = parseAirpSessionTicket(raw);
      return bounded(signal, local => recoverSession(ticket, local));
    },
    /** Requires an already persisted ticket. Uncertain outcomes must replay this exact ticket. */
    generate(raw: AirpSceneTicket, signal?: AbortSignal): Promise<AirpSceneResult> {
      const ticket = parseAirpSceneTicket(raw);
      return bounded(signal, async local => {
        const receipt = parseAirpReceipt(await json(`/conversation-threads/${encodeURIComponent(ticket.binding.threadId)}/interactions`, airpInteraction(ticket.binding, ticket.request), local));
        return afterSubmission(() => read(ticket, receipt, local));
      });
    },
    /** Save this receipt before reading/validating the body, so an invalid candidate can still be discarded. */
    submitGeneration(raw: AirpSceneTicket, signal?: AbortSignal): Promise<AirpInteractionReceipt> {
      const ticket = parseAirpSceneTicket(raw);
      return bounded(signal, async local => parseAirpReceipt(await json(`/conversation-threads/${encodeURIComponent(ticket.binding.threadId)}/interactions`, airpInteraction(ticket.binding, ticket.request), local)));
    },
    readResult(raw: AirpSceneTicket, receipt: AirpInteractionReceipt, signal?: AbortSignal): Promise<AirpSceneResult> {
      const ticket = parseAirpSceneTicket(raw), parsedReceipt = parseAirpReceipt(receipt);
      return bounded(signal, local => read(ticket, parsedReceipt, local));
    },
    /** One fixed Action; native required Updater rejection is not a successful confirmation. */
    control(raw: AirpControlTicket, signal?: AbortSignal): Promise<AirpInteractionReceipt> {
      const ticket = parseAirpControlTicket(raw);
      return bounded(signal, async local => {
        const receipt = parseAirpReceipt(await json(`/conversation-threads/${encodeURIComponent(ticket.binding.threadId)}/interactions`, airpControlInteraction(ticket), local));
        return afterSubmission(() => readControl(ticket, receipt, local));
      });
    },
    readControlResult(raw: AirpControlTicket, receipt: AirpInteractionReceipt, signal?: AbortSignal): Promise<AirpInteractionReceipt> {
      const ticket = parseAirpControlTicket(raw), parsedReceipt = parseAirpReceipt(receipt);
      return bounded(signal, local => readControl(ticket, parsedReceipt, local));
    },
  };
}
