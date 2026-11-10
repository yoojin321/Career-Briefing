import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const repo = getRepository();
  const article = await repo.getArticle(id);
  if (!article) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const analysis = await repo.getAnalysis(id);
  return NextResponse.json({ article, analysis });
}
