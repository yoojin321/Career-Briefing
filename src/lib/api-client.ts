import type {
  Analysis,
  Article,
  Briefing,
  BriefingItem,
  AnalysisStatus,
} from "@/lib/types";

export interface BriefingArticleEntry {
  item: BriefingItem;
  article: Article | null;
  analysisStatus: AnalysisStatus | null;
}

export interface BriefingResponse {
  briefing: Briefing | null;
  articles: BriefingArticleEntry[];
}

export interface StatusResponse {
  config: {
    supabase: boolean;
    naver: boolean;
    llm: boolean;
    adminSecret: boolean;
  };
  repository: "supabase" | "memory";
}

export interface NewsListItem {
  article: Article;
  analysisStatus: AnalysisStatus | null;
}

export interface NewsListResponse {
  items: NewsListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  refreshed: boolean;
  refreshError: string | null;
}

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch("/api/status", { cache: "no-store" });
  if (!res.ok) throw new Error("상태 조회 실패");
  return res.json();
}

export interface AuthState {
  authenticated: boolean;
  authConfigured: boolean;
}

export async function fetchAuth(): Promise<AuthState> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok) return { authenticated: false, authConfigured: false };
  return res.json();
}

export async function login(
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok) return { ok: true };
  const j = await res.json().catch(() => ({}));
  return { ok: false, error: j.error ?? "로그인 실패" };
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

/** 카테고리별 뉴스 목록 (발행일 최신순, 페이지네이션) */
export async function fetchNews(opts: {
  category?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  force?: boolean;
}): Promise<NewsListResponse> {
  const params = new URLSearchParams();
  if (opts.category) params.set("category", opts.category);
  if (opts.q) params.set("q", opts.q);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.pageSize) params.set("pageSize", String(opts.pageSize));
  if (opts.force) params.set("force", "1");
  const res = await fetch(`/api/news?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("뉴스 목록 조회 실패");
  return res.json();
}

export async function fetchArticle(
  id: string,
): Promise<{ article: Article | null; analysis: Analysis | null }> {
  const res = await fetch(`/api/articles/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("기사 조회 실패");
  return res.json();
}

/** 아카이브: 분석 완료 날짜 목록 (로그인 필요) */
export async function fetchArchiveDates(): Promise<{
  dates: string[];
  unauthorized: boolean;
}> {
  const res = await fetch("/api/archive", { cache: "no-store" });
  if (res.status === 401) return { dates: [], unauthorized: true };
  if (!res.ok) throw new Error("아카이브 날짜 조회 실패");
  const json = (await res.json()) as { dates: string[] };
  return { dates: json.dates, unauthorized: false };
}

/** 아카이브: 특정 날짜의 분석 완료 기사 목록 (로그인 필요) */
export async function fetchArchiveByDate(
  date: string,
): Promise<NewsListItem[]> {
  const res = await fetch(`/api/archive?date=${encodeURIComponent(date)}`, {
    cache: "no-store",
  });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error("아카이브 조회 실패");
  const json = (await res.json()) as { items: NewsListItem[] };
  return json.items;
}

export interface AnalyzeResponse {
  status:
    | "completed"
    | "failed"
    | "unconfigured"
    | "reused"
    | "locked"
    | "capped"
    | "unauthorized";
  analysis: Analysis | null;
  message?: string;
  error?: string;
}

/** 사용자 트리거 단일 기사 분석 */
export async function analyzeArticleRequest(
  id: string,
  depth: "simple" | "detailed" = "simple",
): Promise<AnalyzeResponse> {
  const res = await fetch(`/api/news/${id}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ depth }),
  });
  const json = (await res.json()) as AnalyzeResponse;
  // 429(capped)/202(locked)도 JSON 본문을 그대로 반환
  return json;
}

/** 아카이브 등에서 쓰는 브리핑 조회 (레거시 유지) */
export async function fetchBriefing(
  date?: string,
  variant = 0,
): Promise<BriefingResponse> {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  params.set("variant", String(variant));
  const res = await fetch(`/api/briefings?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("브리핑 조회 실패");
  return res.json();
}
