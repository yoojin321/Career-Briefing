import { getRepository } from "@/lib/repo";
import { analyzeArticle, toAnalysisRecord } from "@/lib/ai/analyze";
import type { Analysis, AnalysisDepth } from "@/lib/types";

/** AI 분석 일일 요청 상한 (비용 보호). 환경변수로 조정 가능 */
const BAZE_PROVIDER = "baze";
function analysisDailyCap(): number {
  const raw = process.env.ANALYSIS_DAILY_CAP;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  // 공개 분석 API 악용 시 비용 폭증을 막기 위해 보수적 기본값(50) 사용.
  // 운영 규모에 맞춰 ANALYSIS_DAILY_CAP 으로 상향 가능(하드맥스 2000).
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(n, 2000);
}

/** 분석 잠금 TTL(초): 동일 기사 동시 분석 방지 */
const ANALYZE_LOCK_TTL = 90;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type AnalyzeOutcome =
  | { status: "completed" | "failed" | "unconfigured"; analysis: Analysis }
  | { status: "reused"; analysis: Analysis }
  | { status: "locked"; analysis: Analysis | null }
  | { status: "capped"; analysis: null }
  | { status: "not_found"; analysis: null };

/**
 * 특정 날짜 브리핑의 모든 선정 기사에 대해 분석을 생성/갱신한다. (관리자/배치용)
 * 이미 completed 분석이 있으면 force가 아닌 한 재사용.
 */
export async function analyzeBriefing(
  date: string,
  variant = 0,
  depth: AnalysisDepth = "simple",
  force = false,
): Promise<{ analyzed: Analysis[]; skipped: number }> {
  const repo = getRepository();
  const briefing = await repo.getBriefing(date, variant);
  if (!briefing) return { analyzed: [], skipped: 0 };

  const analyzed: Analysis[] = [];
  let skipped = 0;

  for (const item of briefing.items) {
    const existing = await repo.getAnalysis(item.articleId);
    if (!force && existing && existing.status === "completed") {
      skipped++;
      continue;
    }
    const article = await repo.getArticle(item.articleId);
    if (!article) continue;

    const result = await analyzeArticle(article, depth);
    const record = toAnalysisRecord(article.id, depth, result);
    await repo.saveAnalysis(record);
    analyzed.push(record);
  }

  return { analyzed, skipped };
}

/**
 * 사용자 트리거 단일 기사 분석.
 * 1) 기사 조회 -> 없으면 not_found
 * 2) 기존 completed 분석 있으면 즉시 재사용(reused) — BAZE 미호출
 * 3) 동시 분석 잠금 획득 실패 시 locked (다른 요청이 진행 중)
 * 4) 일일 분석 상한 초과 시 capped
 * 5) BAZE 호출 -> Zod 검증/재시도 -> 저장
 */
export async function analyzeOnDemand(
  articleId: string,
  depth: AnalysisDepth = "simple",
  force = false,
): Promise<AnalyzeOutcome> {
  const repo = getRepository();

  const article = await repo.getArticle(articleId);
  if (!article) return { status: "not_found", analysis: null };

  const existing = await repo.getAnalysis(articleId);
  if (!force && existing && existing.status === "completed") {
    return { status: "reused", analysis: existing };
  }

  const lockKey = `analyze:${articleId}`;
  let locked = false;
  try {
    locked = await repo.acquireLock(lockKey, ANALYZE_LOCK_TTL);
  } catch {
    locked = false;
  }
  if (!locked) {
    // 다른 요청이 분석 중 — 중복 BAZE 호출 방지. 현재 상태(있으면)를 반환.
    return { status: "locked", analysis: existing ?? null };
  }

  try {
    // 재확인: 잠금 획득 사이에 다른 요청이 완료했을 수 있음
    const recheck = await repo.getAnalysis(articleId);
    if (!force && recheck && recheck.status === "completed") {
      return { status: "reused", analysis: recheck };
    }

    // 일일 상한 확인 (completed/failed 와 무관하게 실제 BAZE 호출만 카운트)
    const used = await repo.getApiUsage(BAZE_PROVIDER, today());
    if (used >= analysisDailyCap()) {
      return { status: "capped", analysis: null };
    }
    await repo.incrementApiUsage(BAZE_PROVIDER, today(), 1);

    const result = await analyzeArticle(article, depth);
    const record = toAnalysisRecord(article.id, depth, result);
    const saved = await repo.saveAnalysis(record);
    return { status: result.status === "completed" ? "completed" : result.status === "unconfigured" ? "unconfigured" : "failed", analysis: saved };
  } finally {
    try {
      await repo.releaseLock(lockKey);
    } catch {
      /* ignore */
    }
  }
}

/** 단일 기사 분석 (하위 호환용 래퍼) */
export async function analyzeSingle(
  articleId: string,
  depth: AnalysisDepth = "simple",
  force = false,
): Promise<Analysis | null> {
  const outcome = await analyzeOnDemand(articleId, depth, force);
  return outcome.analysis;
}
