import type {
  Analysis,
  Article,
  Briefing,
  IngestionJob,
  RawArticle,
} from "@/lib/types";

export interface ArticleUpsert extends RawArticle {
  dedupeKey: string;
}

export interface Repository {
  /** 기사 upsert (dedupeKey/url 충돌 시 무시). 삽입된 Article 목록 반환 */
  upsertArticles(items: ArticleUpsert[]): Promise<Article[]>;
  getArticle(id: string): Promise<Article | null>;
  /** 후보 기사 조회: sinceHours 이내 발행 + 카테고리 필터 */
  listCandidates(opts: {
    sinceHours: number;
    categories?: string[];
    limit?: number;
  }): Promise<Article[]>;

  /** 날짜+variant 브리핑 조회 */
  getBriefing(date: string, variant: number): Promise<Briefing | null>;
  getLatestBriefing(): Promise<Briefing | null>;
  listBriefingDates(limit?: number): Promise<string[]>;
  saveBriefing(b: Briefing): Promise<Briefing>;

  /** 기사별 최신 분석 */
  getAnalysis(articleId: string): Promise<Analysis | null>;
  saveAnalysis(a: Analysis): Promise<Analysis>;

  saveJob(job: IngestionJob): Promise<IngestionJob>;
  listJobs(limit?: number): Promise<IngestionJob[]>;

  /** 외부 API 일일 호출량: 특정 provider/day의 현재 누적 호출 수 */
  getApiUsage(provider: string, day: string): Promise<number>;
  /** delta만큼 원자적으로 증가시키고 증가 후 누적 값을 반환 */
  incrementApiUsage(
    provider: string,
    day: string,
    delta: number,
  ): Promise<number>;

  /**
   * 페이지네이션 기사 목록 (발행일 최신순). AI 가중치 선정을 사용하지 않음.
   * q가 있으면 제목/요약에 대해 부분 일치 검색.
   */
  listArticles(opts: {
    category?: string;
    q?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: Article[]; total: number }>;

  /** 분산 잠금 획득(성공 시 true). ttlSeconds 동안 유지. */
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  /** 잠금 해제 */
  releaseLock(key: string): Promise<void>;

  /** 카테고리별 마지막 수집 시각 (없으면 null) */
  getIngestMarker(category: string): Promise<string | null>;
  setIngestMarker(category: string, at: string): Promise<void>;

  /** 기사 발행일(날짜, YYYY-MM-DD) 목록을 최신순으로 (아카이브용) */
  listArticleDates(limit?: number): Promise<string[]>;
  /** 특정 발행 날짜(YYYY-MM-DD, KST 기준)의 기사 목록 (발행 시각 내림차순) */
  listArticlesByDate(date: string): Promise<Article[]>;
}
