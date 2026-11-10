import type { Article, AnalysisDepth } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

/** AI에게 기대하는 JSON 구조 설명 (Zod 스키마와 1:1 대응) */
export const JSON_SHAPE = `{
  "summary": ["핵심 요약 문장 1~3개 (사실 중심, 3줄 이내)"],
  "background": "이슈의 배경과 원인. 확보된 정보 범위 내에서만 작성.",
  "keyConcepts": [{"term": "핵심 키워드", "explanation": "취업 준비생이 이해하기 쉬운 설명"}],
  "industryImpact": {
    "opportunities": ["관련 산업/기업의 기회 1개 이상"],
    "threats": ["위협 1개 이상"],
    "outlook": "전망 (반드시 '분석/예상'임을 전제로 서술)"
  },
  "careerPoints": {
    "companyAnalysis": "기업 분석에서 활용할 관점",
    "coverLetter": "자기소개서 지원동기와 연결할 방향",
    "jobPerspective": "직무 관점에서 생각해 볼 문제",
    "interviewAngle": "면접에서 언급하기 좋은 핵심 논점"
  },
  "interviewQuestions": {
    "basic": {"question": "기본 질문", "answerPoints": ["포인트1","포인트2","포인트3"], "sampleAnswer": "약 30초 분량 예시 답변"},
    "advanced": {"question": "심화 질문", "answerPoints": ["포인트1","포인트2","포인트3"], "sampleAnswer": "약 30초 분량 예시 답변"}
  },
  "confidence": "high | medium | needs_verification",
  "careerRelevance": "high | medium | low (이 기사가 취업·면접 준비에 실제로 얼마나 관련 있는지)",
  "disclaimers": ["사실이 아닌 분석/예상 항목, 확인이 필요한 부분을 명시"]
}`;

export function buildSystemPrompt(): string {
  return [
    "당신은 취업 준비생을 돕는 한국어 뉴스 분석가입니다.",
    "반드시 제공된 기사 정보(제목, 언론사, 발행일, 공식 요약)만을 근거로 분석하세요.",
    "규칙:",
    "1) 기사에 없는 수치, 인용문, 기관 입장, 구체적 사실을 지어내지 마세요.",
    "2) 전망·예측은 반드시 '분석/예상'임을 드러내고 disclaimers에 기록하세요.",
    "3) 근거가 부족하면 confidence를 'needs_verification'으로 설정하고 추측을 최소화하세요.",
    "4) 제목만 제공된 경우(본문 없음) 상세한 배경을 사실처럼 쓰지 말고 제한적으로만 작성하세요.",
    "5) 취업·면접과 실제 관련성이 낮은 기사라면 억지로 연결하지 말고 careerRelevance를 'low'로 설정하세요. 그래도 careerPoints/interviewQuestions 필드는 형식상 간결히 채우되 과장하지 마세요.",
    "6) 출력은 지정된 JSON 스키마를 '정확히' 따르는 JSON 하나만 반환하세요. 코드블록/설명 금지.",
    "",
    "출력 JSON 구조:",
    JSON_SHAPE,
  ].join("\n");
}

export function buildUserPrompt(
  article: Article,
  depth: AnalysisDepth,
): string {
  const lines = [
    `카테고리: ${CATEGORY_LABELS[article.category]}`,
    `제목: ${article.title}`,
    `언론사/출처: ${article.sourceName ?? "미상"}`,
    `발행일: ${article.publishedAt ?? "미상"}`,
    `본문 확보 여부: ${article.hasBody ? "일부 확보" : "없음(제목/메타만)"}`,
  ];
  if (article.description) {
    lines.push(`공식 제공 요약: ${article.description}`);
  } else {
    lines.push(
      "공식 제공 요약: 없음 — 추가 사실을 추측하지 말고 confidence를 needs_verification으로 하세요.",
    );
  }
  lines.push(
    "",
    depth === "detailed"
      ? "분석 깊이: 상세 (각 섹션을 충실히 작성하되 규칙은 반드시 준수)"
      : "분석 깊이: 간단 (핵심 위주로 간결하게)",
    "",
    "위 정보를 바탕으로 JSON만 출력하세요.",
  );
  return lines.join("\n");
}
