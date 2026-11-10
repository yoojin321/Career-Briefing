import type { LlmConfig } from "@/lib/env";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * baseUrl 끝 슬래시를 정리하고 path를 안전하게 결합한다.
 * BAZE/OpenAI 호환 게이트웨이의 경로는 끝 슬래시(`/chat/completions/`)를
 * 요구할 수 있으므로 trailingSlash 옵션으로 제어한다.
 */
export function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${base}/${p}`;
}

/**
 * OpenAI 호환 Chat Completions 호출.
 * LLM_API_BASE_URL을 바꾸면 다른 호환 제공자(BAZE API Gateway 등)로 교체 가능.
 *
 * 참고(BAZE):
 * - 엔드포인트: POST {baseUrl}/chat/completions/  (끝 슬래시)
 * - 인증: Authorization: Bearer <KEY>  (x-api-key도 지원)
 * - Claude 계열 모델로 프록시될 때 response_format(json_object)을 지원하지
 *   않을 수 있어 기본적으로 보내지 않는다. 필요 시 LLM_JSON_MODE=1로 활성화.
 */
/** LLM 호출 결과: 본문 + 종료 사유(잘림 감지용) */
export interface ChatResult {
  content: string;
  /** stop | length | content_filter | ... (제공자별) */
  finishReason: string | null;
  truncated: boolean;
}

/** 재시도 가능한(일시적) 오류 표시용 에러 */
export class RetriableLlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetriableLlmError";
  }
}

/** 재시도 불가(영구) 오류: 인증/권한/요청 형식 등 */
export class FatalLlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalLlmError";
  }
}

export async function chatJson(
  cfg: LlmConfig,
  messages: ChatMessage[],
  maxTokens = 4000,
): Promise<ChatResult> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: 0.3,
    // 응답 잘림(JSON 깨짐) 방지를 위해 충분한 출력 토큰 확보
    max_tokens: maxTokens,
  };
  if (cfg.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  let res: Response;
  try {
    res = await fetch(joinUrl(cfg.baseUrl, "chat/completions/"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    // 네트워크 오류는 일시적 → 재시도 대상
    throw new RetriableLlmError(`네트워크 오류: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const summary = summarizeError(text);
    // 429/5xx는 일시적, 그 외 4xx는 영구 오류로 분류
    if (res.status === 429 || res.status >= 500) {
      throw new RetriableLlmError(`LLM HTTP ${res.status}: ${summary}`);
    }
    throw new FatalLlmError(`LLM HTTP ${res.status}: ${summary}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = json.choices?.[0];
  const content = choice?.message?.content;
  const finishReason = choice?.finish_reason ?? null;
  if (!content) {
    throw new RetriableLlmError("LLM 응답에 content가 없습니다");
  }
  return {
    content,
    finishReason,
    truncated: finishReason === "length",
  };
}

/** 오류 본문을 과도하게 노출하지 않도록 요약(키/민감정보 로그 방지) */
function summarizeError(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.slice(0, 300);
}

/** 모델이 코드블록/여분 텍스트를 섞어도 JSON 본문을 추출 */
export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) return candidate.slice(start, end + 1);
  return candidate.trim();
}

/** 게이트웨이에서 사용 가능한 모델 목록 조회 (대량 호출 전 권한 확인용) */
export async function listModels(
  cfg: LlmConfig,
): Promise<{ ok: boolean; status: number; models: string[]; error?: string }> {
  try {
    const res = await fetch(joinUrl(cfg.baseUrl, "models/"), {
      method: "GET",
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, models: [], error: summarizeError(text) };
    }
    const json = (await res.json()) as {
      data?: { id?: string }[];
      models?: { id?: string; name?: string }[];
    };
    const ids =
      json.data?.map((m) => m.id ?? "").filter(Boolean) ??
      json.models?.map((m) => m.id ?? m.name ?? "").filter(Boolean) ??
      [];
    return { ok: true, status: res.status, models: ids };
  } catch (e) {
    return { ok: false, status: 0, models: [], error: (e as Error).message };
  }
}
