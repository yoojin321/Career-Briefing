import type { Category, RawArticle } from "@/lib/types";

export interface FetchOptions {
  category: Category;
  sinceHours: number;
  /** 카테고리당 최대 수집 개수 */
  limit?: number;
}

export interface AdapterResult {
  adapterId: string;
  articles: RawArticle[];
  errors: string[];
}

export interface NewsSourceAdapter {
  id: string;
  /** 설정(키 등)이 갖춰졌는지 */
  isConfigured(): boolean;
  fetchByCategory(opts: FetchOptions): Promise<AdapterResult>;
}

/**
 * 카테고리별 검색 질의어 세트 (네이버 검색 API 사용).
 * 각 질의어는 해당 분야에서 "뉴스성"이 높은 복합어 위주로 구성해
 * 단일 일반어(예: "AI")로 인한 노이즈를 줄인다. 관련성 최종 판정은
 * classify.ts의 키워드 재분류가 추가로 수행한다.
 */
export const CATEGORY_QUERIES: Record<Category, string[]> = {
  IT_AI: [
    "생성형 AI",
    "AI 반도체",
    "클라우드 컴퓨팅",
    "사이버보안",
    "디지털 전환 DX",
  ],
  ECONOMY: ["기준금리 인상", "원달러 환율", "소비자물가", "기업 실적 발표", "통화정책"],
  SOCIETY: ["고용 노동시장", "저출산 인구", "교육 정책", "청년 일자리"],
  INDUSTRY: ["신사업 전략", "기업 인수합병", "반도체 산업 투자", "자동차 배터리 산업"],
  POLICY: ["정부 정책 발표", "공공기관 혁신", "디지털정부", "규제 개편"],
};
