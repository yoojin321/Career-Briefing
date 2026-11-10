import type { Article, Category, ScoreBreakdown } from "@/lib/types";

/** 중요도 시그널 키워드 사전 (규칙 기반, AI 없이 동작) */
const IMPORTANCE_KEYWORDS = [
  "실적",
  "규제",
  "정책",
  "금리",
  "환율",
  "물가",
  "인수",
  "합병",
  "투자",
  "구조조정",
  "성장률",
  "반도체",
  "AI",
  "인공지능",
  "수출",
  "법안",
  "발표",
  "역대",
  "사상",
  "최대",
  "최초",
];

/** 취업 활용도 시그널 키워드 사전 */
const CAREER_KEYWORDS = [
  "채용",
  "일자리",
  "고용",
  "직무",
  "역량",
  "자격",
  "산업",
  "기업",
  "전략",
  "신사업",
  "경쟁",
  "시장",
  "전망",
  "성장",
  "트렌드",
  "직업",
  "인재",
  "스킬",
];

/** 신뢰도 높은 매체/기관 도메인 (중요도 보정) */
const TRUSTED_DOMAINS = [
  "yna.co.kr",
  "yonhapnews",
  "mk.co.kr",
  "hankyung.com",
  "chosun.com",
  "joongang.co.kr",
  "donga.com",
  "etnews.com",
  "zdnet.co.kr",
  "bok.or.kr",
  "korea.kr",
  "moef.go.kr",
];

export function clamp(x: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, x));
}

/** 최신성 점수: 7일(168h) 선형 감쇠 */
export function recencyScore(
  publishedAt: string | null,
  now: Date = new Date(),
): number {
  if (!publishedAt) return 0.3; // 발행일 미상은 중립-하 점수
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return 0.3;
  const ageHours = (now.getTime() - t) / 36e5;
  if (ageHours < 0) return 1; // 미래 표기 방어
  return clamp(1 - ageHours / 168);
}

function keywordHitRatio(text: string, dict: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of dict) if (lower.includes(kw.toLowerCase())) hits++;
  // 키워드 3개 이상 매칭 시 포화
  return clamp(hits / 3);
}

export function importanceScore(a: Article): number {
  const text = `${a.title} ${a.description ?? ""}`;
  const kw = keywordHitRatio(text, IMPORTANCE_KEYWORDS);
  const domainBonus = TRUSTED_DOMAINS.some((d) => a.url.includes(d)) ? 0.25 : 0;
  const bodyBonus = a.hasBody ? 0.1 : 0;
  return clamp(0.65 * kw + domainBonus + bodyBonus);
}

export function careerRelevanceScore(a: Article): number {
  const text = `${a.title} ${a.description ?? ""}`;
  return keywordHitRatio(text, CAREER_KEYWORDS);
}

/**
 * 다양성 점수: 이미 선정된 카테고리 분포 대비 패널티.
 * selectedCounts[category] = 현재 선정된 개수.
 */
export function diversityScore(
  category: Category,
  selectedCounts: Partial<Record<Category, number>>,
): number {
  const count = selectedCounts[category] ?? 0;
  // 같은 카테고리가 이미 많이 뽑혔으면 급감
  return clamp(1 / (count + 1));
}

export interface BaseScores {
  recency: number;
  importance: number;
  careerRelevance: number;
}

/** 카테고리 독립적인 기본 점수(다양성 제외)를 미리 계산 */
export function baseScores(a: Article, now?: Date): BaseScores {
  return {
    recency: recencyScore(a.publishedAt, now),
    importance: importanceScore(a),
    careerRelevance: careerRelevanceScore(a),
  };
}

export function composeBreakdown(
  base: BaseScores,
  diversity: number,
): ScoreBreakdown {
  return { ...base, diversity };
}
