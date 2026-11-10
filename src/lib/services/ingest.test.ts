import { describe, expect, it } from "vitest";
import { runIngest } from "./ingest";
import type {
  AdapterResult,
  FetchOptions,
  NewsSourceAdapter,
} from "@/lib/sources/types";
import type { Category, RawArticle } from "@/lib/types";

/** 테스트용: 메모리 저장소를 쓰도록 환경변수에서 Supabase를 비운다 */
delete process.env.SUPABASE_URL;
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

function raw(
  title: string,
  url: string,
  category: Category,
  origin: string,
): RawArticle {
  return {
    title,
    url,
    category,
    hasBody: false,
    sourceName: origin,
    publishedAt: new Date().toISOString(),
    description: "",
    raw: { origin },
  };
}

class StubRss implements NewsSourceAdapter {
  id = "rss";
  isConfigured() {
    return true;
  }
  async fetchByCategory(opts: FetchOptions): Promise<AdapterResult> {
    return {
      adapterId: this.id,
      articles: [
        raw(`${opts.category} RSS 기사`, `https://rss.example/${opts.category}`, opts.category, "rss"),
      ],
      errors: [],
    };
  }
}

class FailingNaver implements NewsSourceAdapter {
  id = "naver-news";
  isConfigured() {
    return true;
  }
  async fetchByCategory(): Promise<AdapterResult> {
    throw new Error("네이버 API 장애 시뮬레이션 (HTTP 500)");
  }
}

class WorkingNaver implements NewsSourceAdapter {
  id = "naver-news";
  isConfigured() {
    return true;
  }
  async fetchByCategory(opts: FetchOptions): Promise<AdapterResult> {
    return {
      adapterId: this.id,
      articles: [
        raw(`${opts.category} 네이버 기사`, `https://naver.example/${opts.category}`, opts.category, "naver"),
      ],
      errors: [],
    };
  }
}

describe("runIngest — 소스 복원력 및 중복 제거", () => {
  it("네이버 어댑터가 실패해도 RSS 수집은 유지된다 (요구사항 10)", async () => {
    const result = await runIngest({ categories: ["IT_AI", "ECONOMY"] }, [
      new FailingNaver(),
      new StubRss(),
    ]);
    // RSS 기사는 수집됨
    expect(result.fetched).toBeGreaterThan(0);
    expect(result.bySource["rss"]).toBeGreaterThan(0);
    // 네이버 실패는 에러로 기록되지만 전체는 partial로 계속 진행
    expect(result.errors.join(" ")).toContain("네이버 API 장애");
    expect(result.job.status).toBe("partial");
  });

  it("동일 기사는 소스 간 중복 제거된다 (요구사항 5)", async () => {
    // 같은 제목/URL을 내는 두 어댑터
    class SameUrlNaver extends WorkingNaver {
      async fetchByCategory(opts: FetchOptions): Promise<AdapterResult> {
        return {
          adapterId: this.id,
          articles: [raw("동일 사건 제목", "https://dup.example/1", opts.category, "naver")],
          errors: [],
        };
      }
    }
    class SameUrlRss extends StubRss {
      async fetchByCategory(opts: FetchOptions): Promise<AdapterResult> {
        return {
          adapterId: this.id,
          articles: [raw("동일 사건 제목", "https://dup.example/1", opts.category, "rss")],
          errors: [],
        };
      }
    }
    const result = await runIngest({ categories: ["IT_AI"] }, [
      new SameUrlNaver(),
      new SameUrlRss(),
    ]);
    // 2건 수집되었지만 1건으로 중복 제거
    expect(result.fetched).toBe(2);
    expect(result.deduped).toBe(1);
  });
});
