import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { runIngest } from "@/lib/services/ingest";
import { usageSnapshot } from "@/lib/sources/naver-limits";
import { CATEGORIES, type Category } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  let body: {
    categories?: Category[];
    sinceHours?: number;
    limitPerCategory?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* 본문 없음 허용 */
  }

  const categories = (body.categories ?? [...CATEGORIES]).filter((c) =>
    (CATEGORIES as readonly string[]).includes(c),
  ) as Category[];

  // 소량 테스트 지원: limitPerCategory로 카테고리당 수집량 제한 (기본 15)
  const limitPerCategory =
    typeof body.limitPerCategory === "number"
      ? Math.max(1, Math.min(50, Math.floor(body.limitPerCategory)))
      : undefined;

  const result = await runIngest({
    categories,
    sinceHours: body.sinceHours ?? 48,
    limitPerCategory,
  });

  return NextResponse.json({
    ok: result.job.status !== "failed",
    status: result.job.status,
    fetched: result.fetched,
    inserted: result.inserted,
    deduped: result.deduped,
    usedSinceHours: result.usedSinceHours,
    configured: result.configured,
    bySource: result.bySource,
    byCategory: result.byCategory,
    naverUsage: await usageSnapshot(),
    errors: result.errors,
  });
}
