import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseConfig } from "@/lib/env";
import type {
  Analysis,
  AnalysisContent,
  AnalysisDepth,
  AnalysisStatus,
  Article,
  Briefing,
  BriefingItem,
  Category,
  IngestionJob,
  SelectionStrategy,
  SelectionWeights,
} from "@/lib/types";
import type { ArticleUpsert, Repository } from "./types";

/**
 * Supabase(PostgreSQL) 저장소. 서버 전용(service role key) 클라이언트 사용.
 * 스키마는 supabase/schema.sql 참고.
 */
export class SupabaseRepository implements Repository {
  private client: SupabaseClient;

  constructor(cfg: SupabaseConfig) {
    this.client = createClient(cfg.url, cfg.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async upsertArticles(items: ArticleUpsert[]): Promise<Article[]> {
    if (items.length === 0) return [];
    const rows = items.map((it) => ({
      title: it.title,
      url: it.url,
      source_name: it.sourceName ?? null,
      category: it.category,
      published_at: it.publishedAt ?? null,
      collected_at: new Date().toISOString(),
      description: it.description ?? null,
      has_body: it.hasBody,
      dedupe_key: it.dedupeKey,
      raw: it.raw ?? null,
    }));
    const { data, error } = await this.client
      .from("articles")
      .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select();
    if (error) throw new Error(`upsertArticles: ${error.message}`);
    return (data ?? []).map(mapArticle);
  }

  async getArticle(id: string): Promise<Article | null> {
    const { data, error } = await this.client
      .from("articles")
      .select()
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`getArticle: ${error.message}`);
    return data ? mapArticle(data) : null;
  }

  async listCandidates(opts: {
    sinceHours: number;
    categories?: string[];
    limit?: number;
  }): Promise<Article[]> {
    const cutoff = new Date(Date.now() - opts.sinceHours * 36e5).toISOString();
    let q = this.client
      .from("articles")
      .select()
      .gte("published_at", cutoff)
      .order("published_at", { ascending: false });
    if (opts.categories && opts.categories.length > 0) {
      q = q.in("category", opts.categories);
    }
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(`listCandidates: ${error.message}`);
    return (data ?? []).map(mapArticle);
  }

  async getBriefing(date: string, variant: number): Promise<Briefing | null> {
    const { data, error } = await this.client
      .from("briefings")
      .select("*, briefing_items(*)")
      .eq("briefing_date", date)
      .eq("variant", variant)
      .maybeSingle();
    if (error) throw new Error(`getBriefing: ${error.message}`);
    return data ? mapBriefing(data) : null;
  }

  async getLatestBriefing(): Promise<Briefing | null> {
    const { data, error } = await this.client
      .from("briefings")
      .select("*, briefing_items(*)")
      .order("briefing_date", { ascending: false })
      .order("variant", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`getLatestBriefing: ${error.message}`);
    return data ? mapBriefing(data) : null;
  }

  async listBriefingDates(limit = 30): Promise<string[]> {
    const { data, error } = await this.client
      .from("briefings")
      .select("briefing_date")
      .order("briefing_date", { ascending: false })
      .limit(limit * 2);
    if (error) throw new Error(`listBriefingDates: ${error.message}`);
    const dates = [...new Set((data ?? []).map((r) => r.briefing_date))];
    return dates.slice(0, limit);
  }

  async saveBriefing(b: Briefing): Promise<Briefing> {
    const { data, error } = await this.client
      .from("briefings")
      .upsert(
        {
          id: b.id,
          briefing_date: b.briefingDate,
          variant: b.variant,
          strategy: b.strategy,
          weights: b.weights,
          created_at: b.createdAt,
        },
        { onConflict: "briefing_date,variant" },
      )
      .select()
      .single();
    if (error) throw new Error(`saveBriefing: ${error.message}`);
    const briefingId = data.id as string;

    await this.client.from("briefing_items").delete().eq("briefing_id", briefingId);
    if (b.items.length > 0) {
      const rows = b.items.map((it) => ({
        briefing_id: briefingId,
        article_id: it.articleId,
        rank: it.rank,
        score: it.score,
        score_breakdown: it.scoreBreakdown,
        reason: it.reason,
      }));
      const { error: itemsErr } = await this.client
        .from("briefing_items")
        .insert(rows);
      if (itemsErr) throw new Error(`saveBriefing items: ${itemsErr.message}`);
    }
    return { ...b, id: briefingId };
  }

  async getAnalysis(articleId: string): Promise<Analysis | null> {
    const { data, error } = await this.client
      .from("analyses")
      .select()
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`getAnalysis: ${error.message}`);
    return data ? mapAnalysis(data) : null;
  }

  async saveAnalysis(a: Analysis): Promise<Analysis> {
    const { data, error } = await this.client
      .from("analyses")
      .upsert({
        id: a.id,
        article_id: a.articleId,
        depth: a.depth,
        status: a.status,
        model: a.model,
        content: a.content,
        error: a.error,
        created_at: a.createdAt,
      })
      .select()
      .single();
    if (error) throw new Error(`saveAnalysis: ${error.message}`);
    return mapAnalysis(data);
  }

  async saveJob(job: IngestionJob): Promise<IngestionJob> {
    const { data, error } = await this.client
      .from("ingestion_jobs")
      .upsert({
        id: job.id,
        kind: job.kind,
        status: job.status,
        stats: job.stats,
        error: job.error,
        started_at: job.startedAt,
        finished_at: job.finishedAt,
      })
      .select()
      .single();
    if (error) throw new Error(`saveJob: ${error.message}`);
    return mapJob(data);
  }

  async listJobs(limit = 20): Promise<IngestionJob[]> {
    const { data, error } = await this.client
      .from("ingestion_jobs")
      .select()
      .order("started_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`listJobs: ${error.message}`);
    return (data ?? []).map(mapJob);
  }

  async getApiUsage(provider: string, day: string): Promise<number> {
    const { data, error } = await this.client
      .from("api_usage")
      .select("count")
      .eq("provider", provider)
      .eq("day", day)
      .maybeSingle();
    if (error) throw new Error(`getApiUsage: ${error.message}`);
    return data ? Number(data.count) : 0;
  }

  async incrementApiUsage(
    provider: string,
    day: string,
    delta: number,
  ): Promise<number> {
    const { data, error } = await this.client.rpc("increment_api_usage", {
      p_provider: provider,
      p_day: day,
      p_delta: delta,
    });
    if (error) throw new Error(`incrementApiUsage: ${error.message}`);
    return Number(data);
  }

  async listArticles(opts: {
    category?: string;
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: Article[]; total: number }> {
    const from = (opts.page - 1) * opts.pageSize;
    const to = from + opts.pageSize - 1;
    let q = this.client
      .from("articles")
      .select("*", { count: "exact" })
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(from, to);
    if (opts.category) q = q.eq("category", opts.category);
    if (opts.q && opts.q.trim()) {
      const term = opts.q.trim().replace(/[%,]/g, " ");
      q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }
    const { data, error, count } = await q;
    if (error) throw new Error(`listArticles: ${error.message}`);
    return { items: (data ?? []).map(mapArticle), total: count ?? 0 };
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const { data, error } = await this.client.rpc("acquire_lock", {
      p_key: key,
      p_ttl: ttlSeconds,
    });
    if (error) throw new Error(`acquireLock: ${error.message}`);
    return data === true;
  }

  async releaseLock(key: string): Promise<void> {
    await this.client.from("service_locks").delete().eq("key", key);
  }

  async getIngestMarker(category: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("ingest_markers")
      .select("last_ingested_at")
      .eq("category", category)
      .maybeSingle();
    if (error) throw new Error(`getIngestMarker: ${error.message}`);
    return data ? data.last_ingested_at : null;
  }

  async setIngestMarker(category: string, at: string): Promise<void> {
    const { error } = await this.client
      .from("ingest_markers")
      .upsert({ category, last_ingested_at: at }, { onConflict: "category" });
    if (error) throw new Error(`setIngestMarker: ${error.message}`);
  }

  async listArticleDates(limit = 30): Promise<string[]> {
    // 최근 발행 기사들의 published_at을 가져와 KST 날짜로 그룹핑
    const { data, error } = await this.client
      .from("articles")
      .select("published_at")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(`listArticleDates: ${error.message}`);
    const dates = new Set<string>();
    for (const r of data ?? []) {
      const d = kstDate(r.published_at as string);
      if (d) dates.add(d);
    }
    return [...dates].sort((a, b) => b.localeCompare(a)).slice(0, limit);
  }

  async listArticlesByDate(date: string): Promise<Article[]> {
    // date(KST)의 00:00~24:00을 UTC 범위로 변환해 조회
    const start = new Date(`${date}T00:00:00+09:00`).toISOString();
    const end = new Date(`${date}T00:00:00+09:00`);
    end.setDate(end.getDate() + 1);
    const { data, error } = await this.client
      .from("articles")
      .select()
      .gte("published_at", start)
      .lt("published_at", end.toISOString())
      .order("published_at", { ascending: false });
    if (error) throw new Error(`listArticlesByDate: ${error.message}`);
    return (data ?? []).map(mapArticle);
  }

  async listAnalyzedDates(limit = 60): Promise<string[]> {
    const { data, error } = await this.client
      .from("analyses")
      .select("created_at")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(`listAnalyzedDates: ${error.message}`);
    const dates = new Set<string>();
    for (const r of data ?? []) {
      const d = kstDate(r.created_at as string);
      if (d) dates.add(d);
    }
    return [...dates].sort((a, b) => b.localeCompare(a)).slice(0, limit);
  }

  async listAnalyzedByDate(
    date: string,
  ): Promise<{ article: Article; analysis: Analysis }[]> {
    const start = new Date(`${date}T00:00:00+09:00`).toISOString();
    const endDate = new Date(`${date}T00:00:00+09:00`);
    endDate.setDate(endDate.getDate() + 1);
    const { data, error } = await this.client
      .from("analyses")
      .select("*, articles(*)")
      .eq("status", "completed")
      .gte("created_at", start)
      .lt("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });
    if (error) throw new Error(`listAnalyzedByDate: ${error.message}`);
    const out: { article: Article; analysis: Analysis }[] = [];
    for (const r of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const joined = (r as any).articles;
      if (!joined) continue;
      out.push({ article: mapArticle(joined), analysis: mapAnalysis(r) });
    }
    return out;
  }
}

/** UTC ISO 타임스탬프 → KST(Asia/Seoul) 기준 YYYY-MM-DD */
function kstDate(iso: string): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t + 9 * 36e5).toISOString().slice(0, 10);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapArticle(r: any): Article {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    sourceName: r.source_name ?? null,
    category: r.category as Category,
    publishedAt: r.published_at ?? null,
    collectedAt: r.collected_at,
    description: r.description ?? null,
    hasBody: !!r.has_body,
    dedupeKey: r.dedupe_key,
    raw: r.raw ?? null,
  };
}

function mapBriefing(r: any): Briefing {
  const items: BriefingItem[] = (r.briefing_items ?? [])
    .map((it: any) => ({
      articleId: it.article_id,
      rank: it.rank,
      score: Number(it.score),
      scoreBreakdown: it.score_breakdown,
      reason: it.reason,
    }))
    .sort((a: BriefingItem, b: BriefingItem) => a.rank - b.rank);
  return {
    id: r.id,
    briefingDate: r.briefing_date,
    variant: r.variant,
    strategy: r.strategy as SelectionStrategy,
    weights: r.weights as SelectionWeights,
    createdAt: r.created_at,
    items,
  };
}

function mapAnalysis(r: any): Analysis {
  return {
    id: r.id,
    articleId: r.article_id,
    depth: r.depth as AnalysisDepth,
    status: r.status as AnalysisStatus,
    model: r.model ?? null,
    content: (r.content as AnalysisContent) ?? null,
    error: r.error ?? null,
    createdAt: r.created_at,
  };
}

function mapJob(r: any): IngestionJob {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    stats: r.stats ?? {},
    error: r.error ?? null,
    startedAt: r.started_at,
    finishedAt: r.finished_at ?? null,
  };
}
