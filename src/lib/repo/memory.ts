import { randomUUID } from "node:crypto";
import type {
  Analysis,
  Article,
  Briefing,
  IngestionJob,
} from "@/lib/types";
import type { ArticleUpsert, Repository } from "./types";

/**
 * 인메모리 저장소 (개발/테스트용).
 * 프로세스 생명주기 동안만 유지된다. 실제 수집한 기사만 담으며 가짜 데이터는 넣지 않는다.
 * Next dev 서버에서 모듈 간 공유를 위해 globalThis에 캐싱한다.
 */
class MemoryRepository implements Repository {
  private articles = new Map<string, Article>();
  private byDedupe = new Map<string, string>(); // dedupeKey -> id
  private byUrl = new Map<string, string>();
  private briefings: Briefing[] = [];
  private analyses = new Map<string, Analysis>(); // articleId -> latest
  private jobs: IngestionJob[] = [];

  async upsertArticles(items: ArticleUpsert[]): Promise<Article[]> {
    const inserted: Article[] = [];
    for (const it of items) {
      const urlKey = it.url.toLowerCase();
      if (this.byDedupe.has(it.dedupeKey) || this.byUrl.has(urlKey)) continue;
      const article: Article = {
        id: randomUUID(),
        title: it.title,
        url: it.url,
        sourceName: it.sourceName ?? null,
        category: it.category,
        publishedAt: it.publishedAt ?? null,
        collectedAt: new Date().toISOString(),
        description: it.description ?? null,
        hasBody: it.hasBody,
        dedupeKey: it.dedupeKey,
        raw: it.raw ?? null,
      };
      this.articles.set(article.id, article);
      this.byDedupe.set(article.dedupeKey, article.id);
      this.byUrl.set(urlKey, article.id);
      inserted.push(article);
    }
    return inserted;
  }

  async getArticle(id: string): Promise<Article | null> {
    return this.articles.get(id) ?? null;
  }

  async listCandidates(opts: {
    sinceHours: number;
    categories?: string[];
    limit?: number;
  }): Promise<Article[]> {
    const cutoff = Date.now() - opts.sinceHours * 36e5;
    const cats = opts.categories ? new Set(opts.categories) : null;
    let list = [...this.articles.values()].filter((a) => {
      if (cats && !cats.has(a.category)) return false;
      if (!a.publishedAt) return true;
      const t = Date.parse(a.publishedAt);
      return Number.isNaN(t) ? true : t >= cutoff;
    });
    list.sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    });
    if (opts.limit) list = list.slice(0, opts.limit);
    return list;
  }

  async getBriefing(date: string, variant: number): Promise<Briefing | null> {
    return (
      this.briefings.find(
        (b) => b.briefingDate === date && b.variant === variant,
      ) ?? null
    );
  }

  async getLatestBriefing(): Promise<Briefing | null> {
    if (this.briefings.length === 0) return null;
    return [...this.briefings].sort((a, b) =>
      b.briefingDate.localeCompare(a.briefingDate) || b.variant - a.variant,
    )[0];
  }

  async listBriefingDates(limit = 30): Promise<string[]> {
    const dates = [...new Set(this.briefings.map((b) => b.briefingDate))];
    dates.sort((a, b) => b.localeCompare(a));
    return dates.slice(0, limit);
  }

  async saveBriefing(b: Briefing): Promise<Briefing> {
    const idx = this.briefings.findIndex(
      (x) => x.briefingDate === b.briefingDate && x.variant === b.variant,
    );
    if (idx >= 0) this.briefings[idx] = b;
    else this.briefings.push(b);
    return b;
  }

  async getAnalysis(articleId: string): Promise<Analysis | null> {
    return this.analyses.get(articleId) ?? null;
  }

  async saveAnalysis(a: Analysis): Promise<Analysis> {
    this.analyses.set(a.articleId, a);
    return a;
  }

  async saveJob(job: IngestionJob): Promise<IngestionJob> {
    this.jobs.unshift(job);
    this.jobs = this.jobs.slice(0, 100);
    return job;
  }

  async listJobs(limit = 20): Promise<IngestionJob[]> {
    return this.jobs.slice(0, limit);
  }

  private usage = new Map<string, number>(); // `${provider}:${day}` -> count

  async getApiUsage(provider: string, day: string): Promise<number> {
    return this.usage.get(`${provider}:${day}`) ?? 0;
  }

  async incrementApiUsage(
    provider: string,
    day: string,
    delta: number,
  ): Promise<number> {
    const key = `${provider}:${day}`;
    const next = (this.usage.get(key) ?? 0) + delta;
    this.usage.set(key, next);
    return next;
  }

  async listArticles(opts: {
    category?: string;
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: Article[]; total: number }> {
    let list = [...this.articles.values()];
    if (opts.category) list = list.filter((a) => a.category === opts.category);
    if (opts.q && opts.q.trim()) {
      const term = opts.q.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(term) ||
          (a.description ?? "").toLowerCase().includes(term),
      );
    }
    list.sort((a, b) => {
      const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    });
    const total = list.length;
    const from = (opts.page - 1) * opts.pageSize;
    return { items: list.slice(from, from + opts.pageSize), total };
  }

  private locks = new Map<string, number>(); // key -> lockedUntil(ms)
  private markers = new Map<string, string>();

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const until = this.locks.get(key);
    if (until && until > now) return false;
    this.locks.set(key, now + ttlSeconds * 1000);
    return true;
  }

  async releaseLock(key: string): Promise<void> {
    this.locks.delete(key);
  }

  async getIngestMarker(category: string): Promise<string | null> {
    return this.markers.get(category) ?? null;
  }

  async setIngestMarker(category: string, at: string): Promise<void> {
    this.markers.set(category, at);
  }

  async listArticleDates(limit = 30): Promise<string[]> {
    const dates = new Set<string>();
    for (const a of this.articles.values()) {
      if (!a.publishedAt) continue;
      const t = Date.parse(a.publishedAt);
      if (Number.isNaN(t)) continue;
      dates.add(new Date(t + 9 * 36e5).toISOString().slice(0, 10));
    }
    return [...dates].sort((a, b) => b.localeCompare(a)).slice(0, limit);
  }

  async listArticlesByDate(date: string): Promise<Article[]> {
    const start = new Date(`${date}T00:00:00+09:00`).getTime();
    const end = start + 24 * 36e5;
    return [...this.articles.values()]
      .filter((a) => {
        if (!a.publishedAt) return false;
        const t = Date.parse(a.publishedAt);
        return !Number.isNaN(t) && t >= start && t < end;
      })
      .sort((a, b) => {
        const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return tb - ta;
      });
  }

  async listAnalyzedDates(limit = 60): Promise<string[]> {
    const dates = new Set<string>();
    for (const a of this.analyses.values()) {
      if (a.status !== "completed") continue;
      const t = Date.parse(a.createdAt);
      if (Number.isNaN(t)) continue;
      dates.add(new Date(t + 9 * 36e5).toISOString().slice(0, 10));
    }
    return [...dates].sort((a, b) => b.localeCompare(a)).slice(0, limit);
  }

  async listAnalyzedByDate(
    date: string,
  ): Promise<{ article: Article; analysis: Analysis }[]> {
    const start = new Date(`${date}T00:00:00+09:00`).getTime();
    const end = start + 24 * 36e5;
    const rows: { article: Article; analysis: Analysis }[] = [];
    for (const a of this.analyses.values()) {
      if (a.status !== "completed") continue;
      const t = Date.parse(a.createdAt);
      if (Number.isNaN(t) || t < start || t >= end) continue;
      const article = this.articles.get(a.articleId);
      if (article) rows.push({ article, analysis: a });
    }
    rows.sort(
      (x, y) => Date.parse(y.analysis.createdAt) - Date.parse(x.analysis.createdAt),
    );
    return rows;
  }
}

const g = globalThis as unknown as { __cbMemoryRepo?: MemoryRepository };

export function getMemoryRepository(): Repository {
  if (!g.__cbMemoryRepo) g.__cbMemoryRepo = new MemoryRepository();
  return g.__cbMemoryRepo;
}
