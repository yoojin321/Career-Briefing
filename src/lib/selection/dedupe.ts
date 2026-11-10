import type { RawArticle } from "@/lib/types";

/** 제목 정규화: 공백/특수문자 제거, 소문자화, 흔한 접두/접미 제거 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "") // [단독] 등 대괄호 태그 제거
    .replace(/[^0-9a-z가-힣]/g, "") // 영숫자/한글만
    .trim();
}

/** URL에서 도메인 추출 (실패 시 원본 소문자) */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** 중복 식별 키: 정규화 제목 + 도메인 */
export function dedupeKey(title: string, url: string): string {
  return `${normalizeTitle(title)}@${domainOf(url)}`;
}

/**
 * 간단한 제목 유사도 (Jaccard, bigram 기반) — 동일 사건 중복 제거용.
 * 0~1, 1에 가까울수록 유사.
 */
export function titleSimilarity(a: string, b: string): number {
  const ga = bigrams(normalizeTitle(a));
  const gb = bigrams(normalizeTitle(b));
  if (ga.size === 0 && gb.size === 0) return 1;
  if (ga.size === 0 || gb.size === 0) return 0;
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter++;
  const union = ga.size + gb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  if (s.length === 1) set.add(s);
  return set;
}

/**
 * 원시 기사 목록에서 중복 제거.
 * 1) URL 동일 제거
 * 2) dedupeKey 동일 제거 (정규화 제목 + 도메인; 같은 매체의 동일 기사)
 * 3) (옵션) 제목 유사도 threshold 이상이면 동일 사건으로 간주해 제거
 *
 * similarityThreshold 를 null 로 주면 3단계를 건너뛴다. 이 경우 서로 다른
 * 언론사의 동일 사건 보도는 유지된다(목록 탐색용). 입력 순서를 보존한다.
 */
export function dedupeArticles(
  articles: RawArticle[],
  similarityThreshold: number | null = 0.8,
): RawArticle[] {
  const seenUrls = new Set<string>();
  const seenKeys = new Set<string>();
  const kept: RawArticle[] = [];

  for (const a of articles) {
    const url = a.url.toLowerCase();
    if (seenUrls.has(url)) continue;
    const key = dedupeKey(a.title, a.url);
    if (seenKeys.has(key)) continue;

    if (similarityThreshold !== null) {
      const similar = kept.some(
        (k) => titleSimilarity(k.title, a.title) >= similarityThreshold,
      );
      if (similar) continue;
    }

    seenUrls.add(url);
    seenKeys.add(key);
    kept.push(a);
  }
  return kept;
}
