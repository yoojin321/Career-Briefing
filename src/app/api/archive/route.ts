import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repo";
import { isAuthenticated } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 학습 기록 아카이브 (AI 분석 완료 기사만, 분석일 기준).
 * - 로그인 필요(비로그인 시 401)
 * - date 없음: 분석 완료가 있는 날짜 목록
 * - date=YYYY-MM-DD: 그 날짜에 분석 완료된 기사+분석 목록
 */
export async function GET(req: Request) {
  if (!isAuthenticated(req)) {
    return NextResponse.json(
      { error: "로그인이 필요합니다.", status: "unauthorized" },
      { status: 401 },
    );
  }

  const repo = getRepository();
  const url = new URL(req.url);
  const date = url.searchParams.get("date");

  if (!date) {
    const dates = await repo.listAnalyzedDates(60);
    return NextResponse.json({ dates });
  }

  const rows = await repo.listAnalyzedByDate(date);
  const items = rows.map(({ article, analysis }) => ({
    article,
    analysisStatus: analysis.status,
  }));
  return NextResponse.json({ date, items });
}
