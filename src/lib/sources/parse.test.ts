import { describe, expect, it } from "vitest";
import {
  filterByRecency,
  parseNaverItems,
  parseRss,
  stripHtml,
} from "./parse";

describe("stripHtml", () => {
  it("태그와 엔티티를 제거한다", () => {
    expect(stripHtml("<b>삼성</b>&quot;AI&quot; 투자")).toBe('삼성"AI" 투자');
  });
});

describe("parseNaverItems", () => {
  it("items를 RawArticle로 변환한다", () => {
    const items = [
      {
        title: "<b>삼성</b> AI 투자",
        originallink: "https://news.example.com/1",
        link: "https://n.news.naver.com/1",
        description: "<b>삼성</b>이 투자한다",
        pubDate: "Mon, 10 Nov 2026 09:00:00 +0900",
      },
    ];
    const out = parseNaverItems(items, "IT_AI");
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("삼성 AI 투자");
    expect(out[0].url).toBe("https://news.example.com/1");
    expect(out[0].category).toBe("IT_AI");
    expect(out[0].hasBody).toBe(false);
    expect(out[0].publishedAt).toBe("2026-11-10T00:00:00.000Z");
  });

  it("제목이나 링크가 없으면 건너뛴다", () => {
    const out = parseNaverItems([{ description: "no title" }], "IT_AI");
    expect(out).toHaveLength(0);
  });

  it("배열이 아니면 빈 배열", () => {
    expect(parseNaverItems(null, "IT_AI")).toEqual([]);
  });
});

describe("parseRss", () => {
  it("RSS item을 파싱한다 (CDATA 포함)", () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item>
        <title><![CDATA[정부, 디지털정부 정책 발표]]></title>
        <link>https://korea.kr/news/1</link>
        <pubDate>Mon, 10 Nov 2026 08:00:00 +0900</pubDate>
        <description>세부 내용</description>
      </item>
      <item>
        <title>규제 개편안 공개</title>
        <link>https://korea.kr/news/2</link>
      </item>
    </channel></rss>`;
    const out = parseRss(xml, "POLICY", "대한민국 정책브리핑");
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe("정부, 디지털정부 정책 발표");
    expect(out[0].sourceName).toBe("대한민국 정책브리핑");
    expect(out[1].url).toBe("https://korea.kr/news/2");
  });
});

describe("filterByRecency", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("기준 시간보다 오래된 기사를 제외한다", () => {
    const arts = parseNaverItems(
      [
        {
          title: "최신",
          originallink: "https://a.com/1",
          pubDate: "2026-11-10T06:00:00Z",
        },
        {
          title: "오래됨",
          originallink: "https://a.com/2",
          pubDate: "2026-11-01T06:00:00Z",
        },
      ],
      "IT_AI",
    );
    const out = filterByRecency(arts, 48, now);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("최신");
  });
});
