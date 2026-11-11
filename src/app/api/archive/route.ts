import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repo";
import { isAuthenticated } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 아카이브 (발행일 기준 기사).
 * - date 파라미터 없음: 기사 발행 날짜 목록 반환
 * - date=YYYY-MM-DD: 해당 날짜의 기사 목록 반환(분석 상태는 로그인 시에만)
 */
export async function GET(req: Request) {
  const repo = getRepository();
  const url = new URL(req.url);
  const date = url.searchParams.get("date");

  if (!date) {
    const dates = await repo.listArticleDates(60);
    return NextResponse.json({ dates });
  }

  const articles = await repo.listArticlesByDate(date);
  const authed = isAuthenticated(req);
  const items = await Promise.all(
    articles.map(async (article) => {
      let analysisStatus: string | null = null;
      if (authed) {
        try {
          const a = await repo.getAnalysis(article.id);
          analysisStatus = a?.status ?? null;
        } catch {
          analysisStatus = null;
        }
      }
      return { article, analysisStatus };
    }),
  );

  return NextResponse.json({ date, items });
}
