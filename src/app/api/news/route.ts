import { NextResponse } from "next/server";
import { browseArticles } from "@/lib/services/browse";
import { getRepository } from "@/lib/repo";
import { CATEGORIES, type Category } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 공개 뉴스 목록 (카테고리별, 발행일 최신순, 페이지네이션).
 * - AI 가중치 선정을 사용하지 않음
 * - BAZE API를 호출하지 않음 (목록 단계)
 * - 첫 페이지 조회 시 신선도(기본 3h) 기준 서버 자동 수집, 분산 잠금으로 중복 방지
 * - 수집 실패해도 기존 저장 목록을 반환
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const categoryParam = url.searchParams.get("category") ?? undefined;
  const category =
    categoryParam && (CATEGORIES as readonly string[]).includes(categoryParam)
      ? (categoryParam as Category)
      : undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const force = url.searchParams.get("force") === "1";

  try {
    const result = await browseArticles({
      category,
      q,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
      force,
    });

    const repo = getRepository();
    // 각 기사의 AI 분석 상태만 조회 (BAZE 호출 아님)
    const items = await Promise.all(
      result.items.map(async (article) => {
        let analysisStatus: string | null = null;
        try {
          const a = await repo.getAnalysis(article.id);
          analysisStatus = a?.status ?? null;
        } catch {
          analysisStatus = null;
        }
        return { article, analysisStatus };
      }),
    );

    return NextResponse.json({
      items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
      refreshed: result.refreshed,
      refreshError: result.refreshError,
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, items: [], total: 0 },
      { status: 500 },
    );
  }
}
