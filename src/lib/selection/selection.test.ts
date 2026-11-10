import { describe, expect, it } from "vitest";
import type { Article, Category } from "@/lib/types";
import {
  dedupeArticles,
  dedupeKey,
  normalizeTitle,
  titleSimilarity,
} from "./dedupe";
import { recencyScore } from "./scoring";
import { selectBriefing } from "./select";

function raw(title: string, url: string, category: Category = "IT_AI") {
  return { title, url, category, hasBody: false };
}

function article(
  id: string,
  over: Partial<Article> = {},
): Article {
  return {
    id,
    title: over.title ?? `기사 ${id}`,
    url: over.url ?? `https://example.com/${id}`,
    sourceName: over.sourceName ?? "테스트신문",
    category: over.category ?? "IT_AI",
    publishedAt: over.publishedAt ?? new Date().toISOString(),
    collectedAt: over.collectedAt ?? new Date().toISOString(),
    description: over.description ?? "",
    hasBody: over.hasBody ?? false,
    dedupeKey: over.dedupeKey ?? `k${id}`,
    raw: null,
  };
}

describe("normalizeTitle", () => {
  it("대괄호 태그와 특수문자를 제거한다", () => {
    expect(normalizeTitle("[단독] 삼성, AI 반도체 투자!")).toBe(
      "삼성ai반도체투자",
    );
  });
});

describe("dedupeKey", () => {
  it("제목+도메인으로 키를 만든다", () => {
    const k = dedupeKey("AI 투자 확대", "https://www.example.com/a?b=1");
    expect(k).toBe("ai투자확대@example.com");
  });
});

describe("titleSimilarity", () => {
  it("동일 제목은 1에 가깝다", () => {
    expect(titleSimilarity("AI 반도체 투자", "AI 반도체 투자")).toBe(1);
  });
  it("완전히 다른 제목은 낮다", () => {
    expect(titleSimilarity("금리 인상 발표", "축구 경기 결과")).toBeLessThan(
      0.2,
    );
  });
});

describe("dedupeArticles", () => {
  it("동일 URL을 제거한다", () => {
    const out = dedupeArticles([
      raw("A 제목", "https://x.com/1"),
      raw("다른 제목이지만 같은 링크", "https://x.com/1"),
    ]);
    expect(out).toHaveLength(1);
  });

  it("유사 제목(동일 사건)을 제거한다", () => {
    const out = dedupeArticles([
      raw("삼성전자 AI 반도체 대규모 투자 발표", "https://a.com/1"),
      raw("삼성전자 AI 반도체 대규모 투자 발표합니다", "https://b.com/2"),
      raw("금리 동결 결정", "https://c.com/3"),
    ]);
    expect(out).toHaveLength(2);
  });

  it("입력 순서를 보존한다", () => {
    const out = dedupeArticles([
      raw("첫번째", "https://a.com/1"),
      raw("두번째", "https://b.com/2"),
    ]);
    expect(out[0].title).toBe("첫번째");
  });
});

describe("recencyScore", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("방금 발행된 기사는 1에 가깝다", () => {
    expect(recencyScore("2026-11-10T11:00:00Z", now)).toBeGreaterThan(0.99);
  });
  it("7일 이상 지난 기사는 0", () => {
    expect(recencyScore("2026-11-01T12:00:00Z", now)).toBe(0);
  });
  it("발행일 미상은 중립값", () => {
    expect(recencyScore(null, now)).toBe(0.3);
  });
});

describe("selectBriefing", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("요청 개수만큼 선정한다", () => {
    const arts = [
      article("1", { category: "IT_AI" }),
      article("2", { category: "ECONOMY" }),
      article("3", { category: "SOCIETY" }),
      article("4", { category: "INDUSTRY" }),
    ];
    const out = selectBriefing(arts, { count: 3, now });
    expect(out).toHaveLength(3);
    expect(out.map((i) => i.rank)).toEqual([1, 2, 3]);
  });

  it("카테고리 다양성을 우선해 서로 다른 분야를 선정한다", () => {
    const arts = [
      article("1", { category: "IT_AI", title: "AI 투자 전략" }),
      article("2", { category: "IT_AI", title: "AI 반도체 투자" }),
      article("3", { category: "ECONOMY", title: "금리 정책 발표" }),
    ];
    const out = selectBriefing(arts, { count: 2, now });
    const cats = out.map(
      (i) => arts.find((a) => a.id === i.articleId)!.category,
    );
    expect(new Set(cats).size).toBe(2);
  });

  it("결정적이다 (동일 입력 -> 동일 결과)", () => {
    const arts = [
      article("1", { category: "IT_AI" }),
      article("2", { category: "ECONOMY" }),
      article("3", { category: "SOCIETY" }),
    ];
    const a = selectBriefing(arts, { count: 2, now });
    const b = selectBriefing(arts, { count: 2, now });
    expect(a).toEqual(b);
  });

  it("excludeIds를 제외한다 (다른 뉴스 보기)", () => {
    const arts = [
      article("1", { category: "IT_AI" }),
      article("2", { category: "ECONOMY" }),
      article("3", { category: "SOCIETY" }),
    ];
    const out = selectBriefing(arts, { count: 3, excludeIds: ["1"], now });
    expect(out.map((i) => i.articleId)).not.toContain("1");
    expect(out).toHaveLength(2);
  });

  it("후보보다 많은 개수를 요청하면 가능한 만큼만 반환한다", () => {
    const arts = [article("1")];
    const out = selectBriefing(arts, { count: 5, now });
    expect(out).toHaveLength(1);
  });
});
