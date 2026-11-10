import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { analyzeBriefing, analyzeSingle } from "@/lib/services/analysis";
import { todayKst } from "@/lib/services/briefing";
import type { AnalysisDepth } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  let body: {
    date?: string;
    variant?: number;
    articleId?: string;
    depth?: AnalysisDepth;
    force?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  const depth = body.depth ?? "simple";

  if (body.articleId) {
    const analysis = await analyzeSingle(body.articleId, depth, body.force);
    return NextResponse.json({ ok: !!analysis, analysis });
  }

  const result = await analyzeBriefing(
    body.date ?? todayKst(),
    body.variant ?? 0,
    depth,
    body.force,
  );
  return NextResponse.json({
    ok: true,
    analyzed: result.analyzed.length,
    skipped: result.skipped,
    statuses: result.analyzed.map((a) => ({
      articleId: a.articleId,
      status: a.status,
      error: a.error,
    })),
  });
}
