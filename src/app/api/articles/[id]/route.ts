import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repo";
import { isAuthenticated } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repo = getRepository();
  const article = await repo.getArticle(id);
  if (!article) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // 저장된 AI 분석은 로그인한 사용자에게만 반환한다.
  // 비로그인 시 분석 내용을 숨기고 접근 가능 여부만 알린다(데이터는 보존).
  if (!isAuthenticated(req)) {
    return NextResponse.json({ article, analysis: null, locked: true });
  }

  const analysis = await repo.getAnalysis(id);
  return NextResponse.json({ article, analysis, locked: false });
}
