import { getRepository } from "@/lib/repo";
import { runIngest } from "./ingest";
import type { Article, Category } from "@/lib/types";

/** 기본 갱신 주기(시간). 이보다 오래됐으면 조회 시 자동 수집 */
const DEFAULT_REFRESH_HOURS = 3;
/** 수집 잠금 TTL(초) — 중복 수집 방지 */
const INGEST_LOCK_TTL = 120;

export interface BrowseResult {
  items: Article[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  refreshed: boolean;
  refreshError: string | null;
}

/** 카테고리 수집이 신선한지(갱신 주기 이내인지) */
async function isFresh(
  category: Category,
  refreshHours: number,
): Promise<boolean> {
  try {
    const marker = await getRepository().getIngestMarker(category);
    if (!marker) return false;
    const age = Date.now() - Date.parse(marker);
    return age < refreshHours * 36e5;
  } catch {
    // 마커 조회 실패 시 신선하다고 보고 수집을 건너뛰어 기존 목록을 보여준다
    return true;
  }
}

/**
 * 특정 카테고리를 필요 시 자동 수집한다.
 * - force=true: 수동 새로고침
 * - 아니면 갱신 주기(기본 3h) 초과 시에만 수집
 * 분산 잠금으로 동시 요청의 중복 수집을 방지한다(다른 요청은 기존 목록 사용).
 */
export async function refreshCategoryIfNeeded(
  category: Category,
  opts: { force?: boolean; refreshHours?: number } = {},
): Promise<{ refreshed: boolean; error: string | null }> {
  const repo = getRepository();
  const refreshHours = opts.refreshHours ?? DEFAULT_REFRESH_HOURS;

  if (!opts.force && (await isFresh(category, refreshHours))) {
    return { refreshed: false, error: null };
  }

  const lockKey = `ingest:${category}`;
  let locked = false;
  try {
    locked = await repo.acquireLock(lockKey, INGEST_LOCK_TTL);
  } catch {
    locked = false;
  }
  // 다른 요청이 이미 수집 중 -> 중복 실행하지 않고 기존 목록 사용
  if (!locked) return { refreshed: false, error: null };

  try {
    const result = await runIngest({
      categories: [category],
      sinceHours: 48,
      limitPerCategory: 20,
    });
    await repo.setIngestMarker(category, new Date().toISOString());
    const error =
      result.job.status === "failed"
        ? result.errors.slice(0, 3).join(" | ") || "수집 실패"
        : null;
    return { refreshed: true, error };
  } catch (e) {
    // 수집 실패해도 호출자는 기존 저장 목록을 그대로 보여준다
    return { refreshed: false, error: (e as Error).message };
  } finally {
    try {
      await repo.releaseLock(lockKey);
    } catch {
      /* ignore */
    }
  }
}

/**
 * 카테고리별 기사 목록 조회(페이지네이션, 발행일 최신순).
 * 첫 페이지 조회 시 신선도 기준으로 자동 수집을 시도한다.
 * 뉴스 목록 조회에는 AI(BAZE)를 호출하지 않는다.
 */
export async function browseArticles(opts: {
  category?: Category;
  q?: string;
  page?: number;
  pageSize?: number;
  force?: boolean;
}): Promise<BrowseResult> {
  const repo = getRepository();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));

  let refreshed = false;
  let refreshError: string | null = null;

  // 검색어가 없고 카테고리가 있으며 첫 페이지일 때만 자동 수집 고려
  if (opts.category && !opts.q && (page === 1 || opts.force)) {
    const r = await refreshCategoryIfNeeded(opts.category, {
      force: opts.force,
    });
    refreshed = r.refreshed;
    refreshError = r.error;
  }

  const { items, total } = await repo.listArticles({
    category: opts.category,
    q: opts.q,
    page,
    pageSize,
  });

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
    refreshed,
    refreshError,
  };
}
