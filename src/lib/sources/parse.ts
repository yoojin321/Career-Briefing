import type { Category, RawArticle } from "@/lib/types";

/** 네이버 검색 API가 반환하는 HTML 엔티티/태그를 정리 */
export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** 네이버 뉴스 pubDate (RFC 1123) -> ISO */
export function parseDate(input: string | undefined | null): string | null {
  if (!input) return null;
  const t = Date.parse(input);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

/** 원문 링크에서 언론사 도메인을 추정해 소스명으로 사용 */
export function sourceFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

interface NaverNewsItem {
  title?: string;
  originallink?: string;
  link?: string;
  description?: string;
  pubDate?: string;
}

/**
 * 네이버 뉴스 검색 API 응답(items)을 RawArticle[]로 변환 (순수 함수).
 * 본문은 저장하지 않고 공식 제공 메타(title/description)만 사용.
 */
export function parseNaverItems(
  items: unknown,
  category: Category,
): RawArticle[] {
  if (!Array.isArray(items)) return [];
  const out: RawArticle[] = [];
  for (const it of items as NaverNewsItem[]) {
    const url = it.originallink || it.link;
    const title = it.title ? stripHtml(it.title) : "";
    if (!url || !title) continue;
    out.push({
      title,
      url,
      sourceName: sourceFromUrl(url) ?? "naver-news",
      publishedAt: parseDate(it.pubDate),
      description: it.description ? stripHtml(it.description) : undefined,
      hasBody: false,
      category,
      raw: { origin: "naver", link: it.link },
    });
  }
  return out;
}

/**
 * RSS XML을 RawArticle[]로 변환 (정규식 기반 경량 파서, 외부 의존성 없음).
 * item 의 title/link/pubDate/description 만 사용.
 */
export function parseRss(
  xml: string,
  category: Category,
  defaultSource?: string,
): RawArticle[] {
  const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const out: RawArticle[] = [];
  for (const item of items) {
    const title = extractTag(item, "title");
    const link = extractTag(item, "link");
    const pubDate =
      extractTag(item, "pubDate") || extractTag(item, "dc:date");
    const description = extractTag(item, "description");
    if (!title || !link) continue;
    out.push({
      title: stripHtml(decodeEntities(title)),
      url: link.trim(),
      sourceName: defaultSource ?? sourceFromUrl(link) ?? "rss",
      publishedAt: parseDate(pubDate),
      description: description
        ? stripHtml(decodeEntities(description)).slice(0, 500)
        : undefined,
      hasBody: false,
      category,
      raw: { origin: "rss" },
    });
  }
  return out;
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m) return null;
  let v = m[1];
  const cdata = v.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) v = cdata[1];
  return v.trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** sinceHours 기준으로 오래된 기사 필터 (발행일 있는 것만 엄격 적용) */
export function filterByRecency(
  articles: RawArticle[],
  sinceHours: number,
  now: Date = new Date(),
): RawArticle[] {
  const cutoff = now.getTime() - sinceHours * 36e5;
  return articles.filter((a) => {
    if (!a.publishedAt) return true; // 발행일 미상은 통과 (후속 단계에서 감점)
    const t = Date.parse(a.publishedAt);
    if (Number.isNaN(t)) return true;
    return t >= cutoff;
  });
}
