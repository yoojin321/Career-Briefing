import { getNaverConfig, type NaverConfig } from "@/lib/env";
import type { Category } from "@/lib/types";
import {
  type AdapterResult,
  CATEGORY_QUERIES,
  type FetchOptions,
  type NewsSourceAdapter,
} from "./types";
import { filterByRecency, parseNaverItems } from "./parse";
import { dedupeArticles } from "@/lib/selection/dedupe";
import { classifyCategory } from "./classify";
import { maxCallsPerIngest, tryConsume, remainingDailyCalls } from "./naver-limits";

/** NCP API HUB (당신이 준 공식 문서 기준) */
const HUB_ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/news";
/** 구형 Developers 오픈 API */
const DEV_ENDPOINT = "https://openapi.naver.com/v1/search/news.json";

/**
 * 네이버 뉴스 검색 API 어댑터.
 * - 두 인증 방식 지원: NCP API HUB(기본) / 구형 Developers (NAVER_API_MODE=developers)
 * - 제목/링크/발행일/공식 description 메타만 사용 (본문 미저장).
 * - 무료 사용량 보호: ingest당·일일 호출 상한을 넘지 않음.
 * - 관련성 필터: 검색어 일치만으로 신뢰하지 않고, 제목/요약 재분류 결과가
 *   요청 카테고리와 일치하는 기사만 유지한다.
 */
export class NaverNewsAdapter implements NewsSourceAdapter {
  id = "naver-news";

  isConfigured(): boolean {
    return getNaverConfig() !== null;
  }

  private endpoint(cfg: NaverConfig): string {
    return cfg.mode === "developers" ? DEV_ENDPOINT : HUB_ENDPOINT;
  }

  private authHeaders(cfg: NaverConfig): Record<string, string> {
    if (cfg.mode === "developers") {
      return {
        "X-Naver-Client-Id": cfg.clientId,
        "X-Naver-Client-Secret": cfg.clientSecret,
      };
    }
    // NCP API HUB
    return {
      "X-NCP-APIGW-API-KEY-ID": cfg.clientId,
      "X-NCP-APIGW-API-KEY": cfg.clientSecret,
    };
  }

  async fetchByCategory(opts: FetchOptions): Promise<AdapterResult> {
    const cfg = getNaverConfig();
    if (!cfg) {
      return {
        adapterId: this.id,
        articles: [],
        errors: ["NAVER_CLIENT_ID/SECRET 미설정"],
      };
    }

    const errors: string[] = [];
    const queries = CATEGORY_QUERIES[opts.category];

    // 이번 카테고리에 허용할 호출 수: ingest당 상한을 카테고리 수(5)로 나눠 분배
    const perCategoryBudget = Math.max(1, Math.floor(maxCallsPerIngest() / 5));
    const limit = opts.limit ?? 15;
    const displayPerQuery = Math.min(
      100,
      Math.max(10, Math.ceil(limit / Math.min(queries.length, perCategoryBudget))),
    );

    const collected = [];
    let calls = 0;

    for (const q of queries) {
      if (calls >= perCategoryBudget) break;
      if ((await remainingDailyCalls()) <= 0) {
        errors.push("일일 호출 상한 도달: 무료 사용량 보호를 위해 중단");
        break;
      }
      // 호출 전 카운터 소비 (초과 시 호출 금지)
      if (!(await tryConsume(1))) {
        errors.push("일일 호출 상한 초과: 호출 중단");
        break;
      }
      calls++;

      try {
        const url = this.buildUrl(cfg, q, displayPerQuery);
        const res = await fetch(url, {
          headers: this.authHeaders(cfg),
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          errors.push(
            `query="${q}" HTTP ${res.status} ${summarize(body)}`,
          );
          continue;
        }
        const json = (await res.json()) as { items?: unknown };
        collected.push(...parseNaverItems(json.items, opts.category));
      } catch (e) {
        errors.push(`query="${q}" ${(e as Error).message}`);
      }
    }

    // 1) 발행일 기준 최신성 필터
    const recent = filterByRecency(collected, opts.sinceHours);
    // 2) 관련성 필터: 재분류 결과가 요청 카테고리와 일치하는 기사만 유지
    const relevant = recent.filter(
      (a) =>
        classifyCategory(a.title, a.description, opts.category) ===
        opts.category,
    );
    // 3) 어댑터 내부 중복 제거 (최종 교차소스 중복제거는 ingest에서 수행)
    const unique = dedupeArticles(relevant);
    const out = opts.limit ? unique.slice(0, opts.limit) : unique;
    return { adapterId: this.id, articles: out, errors };
  }

  private buildUrl(cfg: NaverConfig, query: string, display: number): string {
    const base = this.endpoint(cfg);
    const params = `query=${encodeURIComponent(
      query,
    )}&display=${display}&start=1&sort=date`;
    return `${base}?${params}`;
  }
}

function summarize(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 160);
}

export function naverQueriesFor(category: Category): string[] {
  return CATEGORY_QUERIES[category];
}
