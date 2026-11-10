import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repo";
import { todayKst } from "@/lib/services/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 공개 읽기: 특정 날짜 브리핑 + 기사 + 분석 상태 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? todayKst();
  const variant = Number(url.searchParams.get("variant") ?? "0");

  const repo = getRepository();
  const briefing = await repo.getBriefing(date, variant);
  if (!briefing) {
    return NextResponse.json({ briefing: null, articles: [] });
  }

  const articles = await Promise.all(
    briefing.items.map(async (it) => {
      const article = await repo.getArticle(it.articleId);
      const analysis = await repo.getAnalysis(it.articleId);
      return { item: it, article, analysisStatus: analysis?.status ?? null };
    }),
  );

  return NextResponse.json({ briefing, articles });
}
