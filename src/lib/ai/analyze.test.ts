import { describe, expect, it, vi } from "vitest";
import type { AnalysisContent, Article } from "@/lib/types";
import { analyzeArticle, validateAnalysis } from "./analyze";
import { FatalLlmError, RetriableLlmError, type ChatResult } from "./llm";
import type { LlmConfig } from "@/lib/env";

const FAKE_CFG: LlmConfig = {
  baseUrl: "https://x/v1",
  apiKey: "k",
  model: "test-model",
  jsonMode: false,
};

function fakeArticle(hasBody = true): Article {
  return {
    id: "a1",
    title: "테스트 기사",
    url: "https://e.com/1",
    sourceName: "테스트",
    category: "IT_AI",
    publishedAt: new Date().toISOString(),
    collectedAt: new Date().toISOString(),
    description: "요약",
    hasBody,
    dedupeKey: "k",
    raw: null,
  };
}

function ok(content: AnalysisContent): ChatResult {
  return { content: JSON.stringify(content), finishReason: "stop", truncated: false };
}

function validContent(): AnalysisContent {
  return {
    summary: ["요약 1", "요약 2"],
    background: "배경 설명",
    keyConcepts: [
      { term: "AI", explanation: "인공지능" },
      { term: "반도체", explanation: "칩" },
    ],
    industryImpact: {
      opportunities: ["기회1"],
      threats: ["위협1"],
      outlook: "전망(분석)",
    },
    careerPoints: {
      companyAnalysis: "a",
      coverLetter: "b",
      jobPerspective: "c",
      interviewAngle: "d",
    },
    interviewQuestions: {
      basic: {
        question: "q",
        answerPoints: ["1", "2", "3"],
        sampleAnswer: "답변",
      },
      advanced: {
        question: "q2",
        answerPoints: ["1", "2", "3"],
        sampleAnswer: "답변2",
      },
    },
    confidence: "high",
    careerRelevance: "medium",
    disclaimers: [],
  };
}

describe("validateAnalysis", () => {
  it("유효한 JSON을 통과시킨다", () => {
    const r = validateAnalysis(JSON.stringify(validContent()), true);
    expect(r.ok).toBe(true);
  });

  it("코드블록으로 감싸진 JSON도 추출한다", () => {
    const wrapped = "```json\n" + JSON.stringify(validContent()) + "\n```";
    const r = validateAnalysis(wrapped, true);
    expect(r.ok).toBe(true);
  });

  it("answerPoints가 3개가 아니면 실패한다", () => {
    const bad = validContent();
    bad.interviewQuestions.basic.answerPoints = ["1", "2"];
    const r = validateAnalysis(JSON.stringify(bad), true);
    expect(r.ok).toBe(false);
  });

  it("summary가 3개를 초과하면 실패한다", () => {
    const bad = validContent();
    bad.summary = ["1", "2", "3", "4"];
    const r = validateAnalysis(JSON.stringify(bad), true);
    expect(r.ok).toBe(false);
  });

  it("본문 없음 기사는 confidence가 high여도 needs_verification으로 강등한다", () => {
    const r = validateAnalysis(JSON.stringify(validContent()), false);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content.confidence).toBe("needs_verification");
      expect(r.content.disclaimers.length).toBeGreaterThan(0);
    }
  });

  it("깨진 JSON은 실패한다", () => {
    const r = validateAnalysis("not json at all", true);
    expect(r.ok).toBe(false);
  });
});

describe("analyzeArticle — 재시도/잘림/오류 분류", () => {
  it("첫 시도 성공 시 attempts=1, completed", async () => {
    const chat = vi.fn(async () => ok(validContent()));
    const r = await analyzeArticle(fakeArticle(), "simple", 2, chat, FAKE_CFG);
    expect(r.status).toBe("completed");
    expect(r.attempts).toBe(1);
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("잘림(truncated) 발생 시 토큰을 늘려 재시도하고 성공한다", async () => {
    let call = 0;
    const chat = vi.fn(async (_cfg, _msgs, maxTokens?: number) => {
      call++;
      if (call === 1) {
        return { content: '{"summary":["잘린', finishReason: "length", truncated: true } as ChatResult;
      }
      // 두 번째엔 늘어난 토큰으로 호출되어야 함
      expect((maxTokens ?? 0)).toBeGreaterThan(4000);
      return ok(validContent());
    });
    const r = await analyzeArticle(fakeArticle(), "simple", 2, chat, FAKE_CFG);
    expect(r.status).toBe("completed");
    expect(r.attempts).toBe(2);
  });

  it("FatalLlmError(인증 등)는 즉시 실패하고 재시도하지 않는다", async () => {
    const chat = vi.fn(async () => {
      throw new FatalLlmError("LLM HTTP 401: invalid key");
    });
    const r = await analyzeArticle(fakeArticle(), "simple", 2, chat, FAKE_CFG);
    expect(r.status).toBe("failed");
    expect(chat).toHaveBeenCalledTimes(1); // 재시도 없음
    expect(r.diagnostics?.retriable).toBe(false);
  });

  it("RetriableLlmError는 maxRetries까지 재시도 후 실패한다", async () => {
    const chat = vi.fn(async () => {
      throw new RetriableLlmError("LLM HTTP 503");
    });
    const r = await analyzeArticle(fakeArticle(), "simple", 2, chat, FAKE_CFG);
    expect(r.status).toBe("failed");
    expect(chat).toHaveBeenCalledTimes(3); // 최초 + 재시도 2
    expect(r.attempts).toBe(3);
  });

  it("스키마 검증 실패는 피드백 후 재시도하여 복구할 수 있다", async () => {
    let call = 0;
    const chat = vi.fn(async () => {
      call++;
      if (call === 1) return { content: '{"bad":true}', finishReason: "stop", truncated: false } as ChatResult;
      return ok(validContent());
    });
    const r = await analyzeArticle(fakeArticle(), "simple", 2, chat, FAKE_CFG);
    expect(r.status).toBe("completed");
    expect(r.attempts).toBe(2);
  });

  it("cfg가 null이면 unconfigured", async () => {
    const chat = vi.fn(async () => ok(validContent()));
    const r = await analyzeArticle(fakeArticle(), "simple", 2, chat, null);
    expect(r.status).toBe("unconfigured");
    expect(chat).not.toHaveBeenCalled();
  });
});
