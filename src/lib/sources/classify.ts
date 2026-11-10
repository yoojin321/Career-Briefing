import type { Category } from "@/lib/types";

/**
 * 규칙 기반 카테고리 분류기.
 * RSS 피드의 원래 섹션이 우리 5개 카테고리와 1:1로 맞지 않으므로,
 * 제목/요약의 키워드로 재분류한다. (근거는 매칭 키워드로 설명 가능)
 */
const RULES: { category: Category; keywords: string[] }[] = [
  {
    category: "IT_AI",
    keywords: [
      "AI",
      "인공지능",
      "반도체",
      "클라우드",
      "데이터",
      "사이버",
      "보안",
      "디지털",
      "소프트웨어",
      "플랫폼",
      "메타버스",
      "로봇",
      "ICT",
      "IT",
      "네이버",
      "카카오",
      "구글",
      "엔비디아",
      "생성형",
    ],
  },
  {
    category: "ECONOMY",
    keywords: [
      "금리",
      "환율",
      "물가",
      "증시",
      "주가",
      "코스피",
      "코스닥",
      "채권",
      "통화",
      "한국은행",
      "실적",
      "경제성장",
      "GDP",
      "무역",
      "수출",
      "수입",
      "달러",
      "원화",
      "인플레",
      "경기",
    ],
  },
  {
    category: "POLICY",
    keywords: [
      "정부",
      "정책",
      "부처",
      "장관",
      "공공기관",
      "규제",
      "법안",
      "국회",
      "예산",
      "지원책",
      "제도",
      "행정",
      "공공",
      "대통령",
      "기획재정부",
      "산업부",
      "과기정통부",
    ],
  },
  {
    category: "INDUSTRY",
    keywords: [
      "기업",
      "삼성",
      "현대",
      "LG",
      "SK",
      "투자",
      "인수",
      "합병",
      "신사업",
      "공장",
      "생산",
      "매출",
      "실적",
      "전략",
      "경쟁",
      "산업",
      "제조",
      "자동차",
      "배터리",
      "조선",
    ],
  },
  {
    category: "SOCIETY",
    keywords: [
      "노동",
      "고용",
      "일자리",
      "인구",
      "저출산",
      "고령화",
      "교육",
      "복지",
      "사회",
      "청년",
      "주거",
      "의료",
      "환경",
      "사건",
      "국제",
      "외교",
    ],
  },
];

/**
 * 가장 많이 매칭되는 카테고리를 반환. 동점/무매칭 시 fallback 사용.
 */
export function classifyCategory(
  title: string,
  description: string | undefined,
  fallback: Category,
): Category {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  let best: Category | null = null;
  let bestHits = 0;
  for (const rule of RULES) {
    let hits = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw.toLowerCase())) hits++;
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = rule.category;
    }
  }
  return bestHits > 0 && best ? best : fallback;
}
