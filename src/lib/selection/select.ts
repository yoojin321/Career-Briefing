import type {
  Article,
  BriefingItem,
  Category,
  ScoreBreakdown,
  SelectionStrategy,
  SelectionWeights,
} from "@/lib/types";
import { CATEGORY_LABELS, DEFAULT_WEIGHTS } from "@/lib/types";
import {
  type BaseScores,
  baseScores,
  composeBreakdown,
  diversityScore,
} from "./scoring";

function weightedSum(b: ScoreBreakdown, w: SelectionWeights): number {
  return (
    w.recency * b.recency +
    w.importance * b.importance +
    w.careerRelevance * b.careerRelevance +
    w.diversity * b.diversity
  );
}

/** 선정 사유 문장 생성 (사실 기반, 점수 근거) */
function buildReason(a: Article, b: ScoreBreakdown): string {
  const parts: string[] = [];
  const pct = (x: number) => Math.round(x * 100);
  parts.push(`${CATEGORY_LABELS[a.category]} 분야`);
  if (b.recency >= 0.7) parts.push("최신성 높음");
  if (b.importance >= 0.6) parts.push("사회·산업적 중요도 높음");
  if (b.careerRelevance >= 0.6) parts.push("취업 활용도 높음");
  parts.push(
    `점수(최신 ${pct(b.recency)} / 중요 ${pct(b.importance)} / 취업 ${pct(
      b.careerRelevance,
    )} / 다양성 ${pct(b.diversity)})`,
  );
  return parts.join(" · ");
}

export interface SelectOptions {
  count: number;
  weights?: SelectionWeights;
  strategy?: SelectionStrategy;
  /** 제외할 article id (다른 뉴스 보기) */
  excludeIds?: string[];
  now?: Date;
  /** 랜덤 전략에서 재현성 위한 seed (variant) */
  seed?: number;
}

/**
 * Greedy 다양성 선정.
 * - balanced: 가중 점수 + 라운드별 다양성 동적 반영
 * - interest: balanced와 동일 로직(관심 카테고리 필터는 상위 호출자가 처리)
 * - random: seed 기반 결정적 셔플 후 상위 N (다양성 라운드 유지)
 * 동점 처리: published_at desc -> id asc 로 결정적.
 */
export function selectBriefing(
  articles: Article[],
  opts: SelectOptions,
): BriefingItem[] {
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const exclude = new Set(opts.excludeIds ?? []);
  const now = opts.now ?? new Date();
  const strategy = opts.strategy ?? "balanced";

  let pool = articles.filter((a) => !exclude.has(a.id));

  if (strategy === "random") {
    pool = seededShuffle(pool, opts.seed ?? 0);
  }

  // 기본 점수 미리 계산
  const baseMap = new Map<string, BaseScores>();
  for (const a of pool) baseMap.set(a.id, baseScores(a, now));

  const selected: BriefingItem[] = [];
  const counts: Partial<Record<Category, number>> = {};
  const remaining = [...pool];

  const target = Math.min(opts.count, remaining.length);

  for (let rank = 1; rank <= target; rank++) {
    let best: { idx: number; score: number; breakdown: ScoreBreakdown } | null =
      null;

    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[i];
      const base = baseMap.get(a.id)!;
      const div = diversityScore(a.category, counts);
      const breakdown = composeBreakdown(base, div);
      const score =
        strategy === "random"
          ? div * weights.diversity + 1e-6 * (remaining.length - i) // 셔플 순서 우선, 다양성 보조
          : weightedSum(breakdown, weights);

      if (best === null || isBetter(a, score, remaining[best.idx], best.score)) {
        best = { idx: i, score, breakdown };
      }
    }

    if (!best) break;
    const chosen = remaining[best.idx];
    selected.push({
      articleId: chosen.id,
      rank,
      score: round4(best.score),
      scoreBreakdown: roundBreakdown(best.breakdown),
      reason: buildReason(chosen, best.breakdown),
    });
    counts[chosen.category] = (counts[chosen.category] ?? 0) + 1;
    remaining.splice(best.idx, 1);
  }

  return selected;
}

/** 더 나은 후보 판정: 점수 높은 쪽, 동점이면 최신, 그다음 id 사전순 */
function isBetter(
  a: Article,
  sa: number,
  b: Article,
  sb: number,
): boolean {
  if (sa !== sb) return sa > sb;
  const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
  const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
  if (ta !== tb) return ta > tb;
  return a.id < b.id;
}

/** 결정적 셔플 (mulberry32 PRNG) */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed >>> 0);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}

function roundBreakdown(b: ScoreBreakdown): ScoreBreakdown {
  return {
    recency: round4(b.recency),
    importance: round4(b.importance),
    careerRelevance: round4(b.careerRelevance),
    diversity: round4(b.diversity),
  };
}
