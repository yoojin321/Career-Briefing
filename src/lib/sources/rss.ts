import type { Category } from "@/lib/types";
import { dedupeArticles } from "@/lib/selection/dedupe";
import {
  type AdapterResult,
  type FetchOptions,
  type NewsSourceAdapter,
} from "./types";
import { filterByRecency, parseRss } from "./parse";
import { classifyCategory } from "./classify";

interface RssFeed {
  url: string;
  source: string;
  /** 피드의 대략적 성격 (분류 실패 시 fallback으로 사용) */
  hint: Category;
}

/**
 * 공개 RSS 피드 목록 (키 불필요).
 * 연합뉴스는 카테고리별 공식 RSS를 제공한다. 피드 섹션이 우리 5개 카테고리와
 * 정확히 일치하지 않으므로, 수집 후 classifyCategory로 재분류한다.
 * 필요 시 피드를 추가/교체할 수 있다. 공식/공개 피드만 사용하세요.
 */
export const RSS_FEEDS: RssFeed[] = [
  { url: "https://www.yna.co.kr/rss/economy.xml", source: "연합뉴스", hint: "ECONOMY" },
  { url: "https://www.yna.co.kr/rss/industry.xml", source: "연합뉴스", hint: "INDUSTRY" },
  { url: "https://www.yna.co.kr/rss/politics.xml", source: "연합뉴스", hint: "POLICY" },
  { url: "https://www.yna.co.kr/rss/society.xml", source: "연합뉴스", hint: "SOCIETY" },
  { url: "https://www.yna.co.kr/rss/news.xml", source: "연합뉴스", hint: "SOCIETY" },
];

/**
 * RSS 어댑터.
 * 모든 피드를 수집·재분류한 뒤 요청 카테고리에 해당하는 기사만 반환한다.
 * 키가 필요 없으므로 항상 configured.
 */
export class RssAdapter implements NewsSourceAdapter {
  id = "rss";

  /** 한 번의 ingest 동안 피드 재다운로드를 막기 위한 짧은 캐시 (TTL 60초) */
  private cache: { at: number; items: ClassifiedArticle[] } | null = null;

  constructor(private readonly feeds: RssFeed[] = RSS_FEEDS) {}

  isConfigured(): boolean {
    return true;
  }

  private async loadAll(): Promise<{
    items: ClassifiedArticle[];
    errors: string[];
  }> {
    const errors: string[] = [];
    if (this.cache && Date.now() - this.cache.at < 60_000) {
      return { items: this.cache.items, errors };
    }

    const collected: ClassifiedArticle[] = [];
    for (const feed of this.feeds) {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "CareerBriefing/0.1 (+rss)" },
          cache: "no-store",
        });
        if (!res.ok) {
          errors.push(`${feed.source} ${feed.url} HTTP ${res.status}`);
          continue;
        }
        const xml = await res.text();
        const parsed = parseRss(xml, feed.hint, feed.source);
        for (const a of parsed) {
          a.category = classifyCategory(a.title, a.description, feed.hint);
        }
        collected.push(...parsed);
      } catch (e) {
        errors.push(`${feed.source} ${feed.url} ${(e as Error).message}`);
      }
    }
    this.cache = { at: Date.now(), items: collected };
    return { items: collected, errors };
  }

  async fetchByCategory(opts: FetchOptions): Promise<AdapterResult> {
    const { items, errors } = await this.loadAll();
    const inCategory = items.filter((a) => a.category === opts.category);
    const recent = filterByRecency(inCategory, opts.sinceHours);
    const unique = dedupeArticles(recent);
    const limited = opts.limit ? unique.slice(0, opts.limit) : unique;
    return { adapterId: this.id, articles: limited, errors };
  }
}

type ClassifiedArticle = ReturnType<typeof parseRss>[number];
