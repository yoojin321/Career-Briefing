import { z } from "zod";

/** 5개 기본 카테고리 */
export const CATEGORIES = [
  "IT_AI",
  "ECONOMY",
  "SOCIETY",
  "INDUSTRY",
  "POLICY",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  IT_AI: "IT / AI",
  ECONOMY: "경제 / 금융",
  SOCIETY: "시사 / 사회",
  INDUSTRY: "산업 / 기업",
  POLICY: "정책 / 공공기관",
};

export const CategorySchema = z.enum(CATEGORIES);

/** 어댑터가 반환하는 원시 기사 (정규화 전) */
export const RawArticleSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  sourceName: z.string().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  description: z.string().optional(),
  hasBody: z.boolean().default(false),
  category: CategorySchema,
  raw: z.record(z.unknown()).optional(),
});
export type RawArticle = z.infer<typeof RawArticleSchema>;

/** 저장된 정규화 기사 */
export interface Article {
  id: string;
  title: string;
  url: string;
  sourceName: string | null;
  category: Category;
  publishedAt: string | null; // ISO
  collectedAt: string; // ISO
  description: string | null;
  hasBody: boolean;
  dedupeKey: string;
  raw?: Record<string, unknown> | null;
}

/** 선정 점수 분해 */
export interface ScoreBreakdown {
  recency: number;
  importance: number;
  careerRelevance: number;
  diversity: number;
}

export interface BriefingItem {
  articleId: string;
  rank: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  reason: string;
}

export interface Briefing {
  id: string;
  briefingDate: string; // YYYY-MM-DD
  variant: number;
  strategy: SelectionStrategy;
  weights: SelectionWeights;
  createdAt: string;
  items: BriefingItem[];
}

export type SelectionStrategy = "balanced" | "interest" | "random";

export interface SelectionWeights {
  recency: number;
  importance: number;
  careerRelevance: number;
  diversity: number;
}

export const DEFAULT_WEIGHTS: SelectionWeights = {
  recency: 0.25,
  importance: 0.3,
  careerRelevance: 0.3,
  diversity: 0.15,
};

/** ---- AI 분석 계약 (Zod) ---- */
export const AnalysisContentSchema = z.object({
  summary: z.array(z.string().min(1)).min(1).max(3),
  background: z.string().min(1),
  keyConcepts: z
    .array(
      z.object({
        term: z.string().min(1),
        explanation: z.string().min(1),
      }),
    )
    .min(2)
    .max(3),
  industryImpact: z.object({
    opportunities: z.array(z.string()).min(1),
    threats: z.array(z.string()).min(1),
    outlook: z.string().min(1),
  }),
  careerPoints: z.object({
    companyAnalysis: z.string().min(1),
    coverLetter: z.string().min(1),
    jobPerspective: z.string().min(1),
    interviewAngle: z.string().min(1),
  }),
  interviewQuestions: z.object({
    basic: z.object({
      question: z.string().min(1),
      answerPoints: z.array(z.string().min(1)).length(3),
      sampleAnswer: z.string().min(1),
    }),
    advanced: z.object({
      question: z.string().min(1),
      answerPoints: z.array(z.string().min(1)).length(3),
      sampleAnswer: z.string().min(1),
    }),
  }),
  confidence: z.enum(["high", "medium", "needs_verification"]),
  /** 취업·면접 관련성 ("low"이면 억지 연결 대신 낮음으로 명시) */
  careerRelevance: z
    .enum(["high", "medium", "low"])
    .default("medium"),
  disclaimers: z.array(z.string()).default([]),
});
export type AnalysisContent = z.infer<typeof AnalysisContentSchema>;

export type AnalysisStatus =
  | "pending"
  | "completed"
  | "failed"
  | "unconfigured";

export type AnalysisDepth = "simple" | "detailed";

export interface Analysis {
  id: string;
  articleId: string;
  depth: AnalysisDepth;
  status: AnalysisStatus;
  model: string | null;
  content: AnalysisContent | null;
  error: string | null;
  createdAt: string;
}

/** 사용자 설정 (localStorage) */
export const SettingsSchema = z.object({
  categories: z.array(CategorySchema).default([...CATEGORIES]),
  dailyCount: z.number().int().min(1).max(10).default(3),
  strategy: z.enum(["balanced", "interest", "random"]).default("balanced"),
  depth: z.enum(["simple", "detailed"]).default("simple"),
  darkMode: z.boolean().default(false),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  categories: [...CATEGORIES],
  dailyCount: 3,
  strategy: "balanced",
  depth: "simple",
  darkMode: false,
};

export interface IngestionJob {
  id: string;
  kind: "ingest" | "select" | "analyze" | "cron";
  status: "success" | "partial" | "failed";
  stats: Record<string, unknown>;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}
