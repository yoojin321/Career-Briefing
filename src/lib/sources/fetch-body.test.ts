import { describe, expect, it } from "vitest";
import { extractArticleText, isPathAllowed } from "./fetch-body";

describe("isPathAllowed (robots.txt)", () => {
  it("규칙이 없으면 허용", () => {
    expect(isPathAllowed("", "/news/1")).toBe(true);
  });

  it("* 그룹의 Disallow 경로를 차단", () => {
    const robots = "User-agent: *\nDisallow: /private";
    expect(isPathAllowed(robots, "/private/x")).toBe(false);
    expect(isPathAllowed(robots, "/news/1")).toBe(true);
  });

  it("빈 Disallow는 전체 허용", () => {
    const robots = "User-agent: *\nDisallow:";
    expect(isPathAllowed(robots, "/anything")).toBe(true);
  });

  it("더 긴 Allow가 Disallow를 이긴다", () => {
    const robots = "User-agent: *\nDisallow: /news\nAllow: /news/public";
    expect(isPathAllowed(robots, "/news/public/1")).toBe(true);
    expect(isPathAllowed(robots, "/news/secret")).toBe(false);
  });

  it("우리 봇 이름 그룹이 * 보다 우선", () => {
    const robots =
      "User-agent: careerbriefingbot\nDisallow:\n\nUser-agent: *\nDisallow: /";
    // 봇 전용 그룹이 전체 허용이므로 통과
    expect(isPathAllowed(robots, "/news/1")).toBe(true);
  });

  it("전체 차단(/)", () => {
    const robots = "User-agent: *\nDisallow: /";
    expect(isPathAllowed(robots, "/news/1")).toBe(false);
  });

  it("와일드카드 매칭", () => {
    const robots = "User-agent: *\nDisallow: /*.pdf$";
    expect(isPathAllowed(robots, "/files/report.pdf")).toBe(false);
    expect(isPathAllowed(robots, "/files/report.html")).toBe(true);
  });
});

describe("extractArticleText", () => {
  it("<article> 내부의 <p> 텍스트를 추출", () => {
    const html = `<html><body>
      <nav><p>메뉴</p></nav>
      <article>
        <p>이것은 본문 첫 문단입니다. 충분히 긴 문장으로 구성되어 있습니다.</p>
        <p>두 번째 문단도 의미 있는 내용을 담고 있어 추출 대상이 됩니다.</p>
      </article>
    </body></html>`;
    const text = extractArticleText(html);
    expect(text).toContain("본문 첫 문단");
    expect(text).toContain("두 번째 문단");
  });

  it("script/style을 제거", () => {
    const html = `<article><script>alert('x')</script><p>${"실제 본문 내용입니다. ".repeat(
      5,
    )}</p><style>.a{}</style></article>`;
    const text = extractArticleText(html);
    expect(text).not.toContain("alert");
    expect(text).not.toContain(".a{}");
    expect(text).toContain("실제 본문 내용");
  });

  it("짧은 캡션/메뉴 문단은 제외", () => {
    const html = `<article><p>짧음</p><p>${"이 문단은 길이가 충분하여 본문으로 간주됩니다. ".repeat(
      3,
    )}</p></article>`;
    const text = extractArticleText(html);
    expect(text).not.toContain("짧음");
    expect(text).toContain("본문으로 간주");
  });
});
