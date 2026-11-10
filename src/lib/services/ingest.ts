import { randomUUID } from "node:crypto";
import { getRepository } from "@/lib/repo";
import type { ArticleUpsert } from "@/lib/repo";
import { dedupeArticles, dedupeKey } from "@/lib/selection/dedupe";
import { NaverNewsAdapter } from "@/lib/sources/naver";
import { RssAdapter } from "@/lib/sources/rss";
import type { NewsSourceAdapter } from "@/lib/sources/types";
import {
  CATEGORIES,
  type Category,
  type IngestionJob,
  type RawArticle,
} from "@/lib/types";

export interface IngestOptions {
  categories?: Category[];
  /** 기본 48시간, 부족하면 최대 7일(168h)까지 확장 */
  sinceHours?: number;
  limitPerCategory?: number;
}

export interface IngestResult {
  job: IngestionJob;
  inserted: number;
  fetched: number;
  deduped: number;
  usedSinceHours: number;
  errors: string[];
  configured: { naver: boolean };
  /** 소스별 수집 건수(중복 제거 전) */
  bySource: Record<string, number>;
  /** 최종(중복 제거 후) 카테고리 분포 */
  byCategory: Record<string, number>;
}

function defaultAdapters(): NewsSourceAdapter[] {
  return [new NaverNewsAdapter(), new RssAdapter()];
}

/**
 * 수집 실행: 어댑터로 기사 수집 -> 정규화/중복제거 -> 저장 -> 작업 로그.
 * 유효 기사가 부족하면 48h -> 96h -> 168h로 범위를 확장한다.
 */
export async function runIngest(
  opts: IngestOptions = {},
  adapters: NewsSourceAdapter[] = defaultAdapters(),
): Promise<IngestResult> {
  const repo = getRepository();
  const categories = opts.categories ?? [...CATEGORIES];
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  const naverConfigured = adapters.some(
    (a) => a.id === "naver-news" && a.isConfigured(),
  );

  const windows = buildWindows(opts.sinceHours ?? 48);
  let all: RawArticle[] = [];
  let usedSinceHours = windows[0];

  const bySource: Record<string, number> = {};

  for (const win of windows) {
    usedSinceHours = win;
    all = [];
    for (const key of Object.keys(bySource)) delete bySource[key];
    for (const category of categories) {
      for (const adapter of adapters) {
        try {
          const res = await adapter.fetchByCategory({
            category,
            sinceHours: win,
            limit: opts.limitPerCategory ?? 15,
          });
          all.push(...res.articles);
          bySource[adapter.id] =
            (bySource[adapter.id] ?? 0) + res.articles.length;
          for (const e of res.errors) errors.push(`[${adapter.id}/${category}] ${e}`);
        } catch (e) {
          errors.push(`[${adapter.id}/${category}] ${(e as Error).message}`);
        }
      }
    }
    // 카테고리 다양성 확보를 위해 최소 후보 수 기준
    if (dedupeArticles(all).length >= Math.max(categories.length, 6)) break;
  }

  const fetched = all.length;
  const unique = dedupeArticles(all);
  const deduped = fetched - unique.length;

  const byCategory: Record<string, number> = {};
  for (const a of unique) {
    byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
  }

  const upserts: ArticleUpsert[] = unique.map((a) => ({
    ...a,
    dedupeKey: dedupeKey(a.title, a.url),
  }));

  let inserted = 0;
  try {
    const rows = await repo.upsertArticles(upserts);
    inserted = rows.length;
  } catch (e) {
    errors.push(`저장 실패: ${(e as Error).message}`);
  }

  const status: IngestionJob["status"] =
    fetched === 0 && errors.length > 0
      ? "failed"
      : errors.length > 0
        ? "partial"
        : "success";

  const job: IngestionJob = {
    id: randomUUID(),
    kind: "ingest",
    status,
    stats: {
      fetched,
      inserted,
      deduped,
      usedSinceHours,
      naverConfigured,
      bySource,
      byCategory,
    },
    error: errors.length ? errors.slice(0, 10).join(" | ") : null,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  try {
    await repo.saveJob(job);
  } catch {
    /* 로그 저장 실패는 치명적이지 않음 */
  }

  return {
    job,
    inserted,
    fetched,
    deduped,
    usedSinceHours,
    errors,
    configured: { naver: naverConfigured },
    bySource,
    byCategory,
  };
}

function buildWindows(base: number): number[] {
  const windows = [base];
  if (base < 96) windows.push(96);
  if (base < 168) windows.push(168);
  return windows;
}
