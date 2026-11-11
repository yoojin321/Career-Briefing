import { randomUUID } from "node:crypto";
import { getLlmConfig } from "@/lib/env";
import {
  type Analysis,
  type AnalysisContent,
  AnalysisContentSchema,
  type AnalysisDepth,
  type Article,
} from "@/lib/types";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import {
  type ChatMessage,
  FatalLlmError,
  RetriableLlmError,
  chatJson,
  extractJson,
} from "./llm";

export interface AnalyzeResult {
  status: Analysis["status"];
  content: AnalysisContent | null;
  model: string | null;
  error: string | null;
  /** 실제 시도 횟수(1=첫 시도 성공) */
  attempts: number;
  /** 마지막 종료 사유/잘림 여부 등 진단 */
  diagnostics?: {
    lastFinishReason?: string | null;
    truncated?: boolean;
    retriable?: boolean;
  };
}

/**
 * 원시 JSON 문자열을 파싱하고 Zod로 검증한다 (순수, 테스트 대상).
 * 본문 없음(hasBody=false)인 기사는 confidence를 needs_verification으로 강제.
 */
export function validateAnalysis(
  raw: string,
  hasBody: boolean,
): { ok: true; content: AnalysisContent } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (e) {
    return { ok: false, error: `JSON 파싱 실패: ${(e as Error).message}` };
  }
  const result = AnalysisContentSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `스키마 검증 실패: ${result.error.issues
        .map((i) => `${i.path.join(".")}:${i.message}`)
        .join("; ")
        .slice(0, 400)}`,
    };
  }
  const content = result.data;
  if (!hasBody && content.confidence === "high") {
    // 근거 부족 기사에 과신 금지
    content.confidence = "needs_verification";
    if (
      !content.disclaimers.some((d) => d.includes("제목") || d.includes("확인"))
    ) {
      content.disclaimers.push(
        "제목/메타 정보만으로 작성되어 세부 사실은 원문 확인이 필요합니다.",
      );
    }
  }
  return { ok: true, content };
}

/** chatJson 시그니처(테스트 주입용) */
export type ChatFn = (
  cfg: import("@/lib/env").LlmConfig,
  messages: ChatMessage[],
  maxTokens?: number,
) => Promise<import("./llm").ChatResult>;

/**
 * 기사 1건을 분석한다. 키 미설정 시 'unconfigured', 재시도 후 실패 시 'failed'.
 * chat/cfgOverride는 테스트 주입용(미지정 시 실제 chatJson + 환경변수 사용).
 */
export async function analyzeArticle(
  article: Article,
  depth: AnalysisDepth,
  maxRetries = 2,
  chat: ChatFn = chatJson,
  cfgOverride?: import("@/lib/env").LlmConfig | null,
  bodyText?: string | null,
): Promise<AnalyzeResult> {
  const cfg = cfgOverride !== undefined ? cfgOverride : getLlmConfig();
  if (!cfg) {
    return {
      status: "unconfigured",
      content: null,
      model: null,
      error: "LLM_API_KEY 미설정",
      attempts: 0,
    };
  }

  // 본문 발췌가 있으면 근거가 충분하므로 hasBody로 취급(과도한 confidence 강등 방지)
  const effectiveHasBody =
    article.hasBody || !!(bodyText && bodyText.trim().length > 0);

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(article, depth, bodyText) },
  ];

  let lastError = "";
  let lastFinishReason: string | null = null;
  let lastTruncated = false;
  let attempts = 0;
  // 잘림이 반복되면 출력 토큰을 늘려 재시도
  let maxTokens = 4000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;
    try {
      const result = await chat(cfg, messages, maxTokens);
      lastFinishReason = result.finishReason;
      lastTruncated = result.truncated;

      if (result.truncated) {
        // 응답이 토큰 한도로 잘림 → JSON 깨짐. 토큰을 늘려 제한적으로 재시도.
        lastError = `응답이 토큰 한도로 잘림(finish_reason=length). max_tokens=${maxTokens}`;
        maxTokens = Math.min(maxTokens + 2000, 8000);
        messages.length = 2; // 피드백 누적 제거(프롬프트 길이 절약)
        continue;
      }

      const validated = validateAnalysis(result.content, effectiveHasBody);
      if (validated.ok) {
        return {
          status: "completed",
          content: validated.content,
          model: cfg.model,
          error: null,
          attempts,
          diagnostics: { lastFinishReason, truncated: false },
        };
      }
      // 스키마 검증 실패 → 1회성 형식 오류일 수 있어 피드백 후 재시도(제한적)
      lastError = validated.error;
      messages.push({ role: "assistant", content: result.content.slice(0, 2000) });
      messages.push({
        role: "user",
        content: `위 응답이 스키마 검증에 실패했습니다(${validated.error}). 설명 없이 지정된 JSON 스키마를 정확히 따르는 JSON만 다시 출력하세요.`,
      });
    } catch (e) {
      if (e instanceof FatalLlmError) {
        // 인증/권한/요청 형식 오류 → 재시도 무의미. 즉시 실패.
        return {
          status: "failed",
          content: null,
          model: cfg.model,
          error: e.message,
          attempts,
          diagnostics: { retriable: false },
        };
      }
      // RetriableLlmError 및 기타 → 재시도 루프 계속
      lastError = (e as RetriableLlmError).message ?? String(e);
    }
  }

  return {
    status: "failed",
    content: null,
    model: cfg.model,
    error: lastError || "알 수 없는 분석 실패",
    attempts,
    diagnostics: { lastFinishReason, truncated: lastTruncated, retriable: true },
  };
}

/** AnalyzeResult -> 저장용 Analysis 레코드.
 * 실패 시 error에 재시도 횟수·종료사유 등 진단을 함께 기록해 서버에서 확인 가능. */
export function toAnalysisRecord(
  articleId: string,
  depth: AnalysisDepth,
  r: AnalyzeResult,
): Analysis {
  let error = r.error;
  if (r.status === "failed" && error) {
    const parts: string[] = [`attempts=${r.attempts}`];
    if (r.diagnostics?.truncated) parts.push("truncated=true");
    if (r.diagnostics?.lastFinishReason)
      parts.push(`finish=${r.diagnostics.lastFinishReason}`);
    if (r.diagnostics?.retriable === false) parts.push("retriable=false");
    error = `[${parts.join(" ")}] ${error}`;
  }
  return {
    id: randomUUID(),
    articleId,
    depth,
    status: r.status,
    model: r.model,
    content: r.content,
    error,
    createdAt: new Date().toISOString(),
  };
}
