import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { getOrCreateBriefing, todayKst } from "@/lib/services/briefing";
import type { Category, SelectionStrategy } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = checkAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  let body: {
    date?: string;
    count?: number;
    strategy?: SelectionStrategy;
    categories?: Category[];
    regenerate?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* ignore */
  }

  const briefing = await getOrCreateBriefing({
    date: body.date ?? todayKst(),
    count: body.count,
    strategy: body.strategy,
    categories: body.categories,
    regenerate: body.regenerate,
  });

  return NextResponse.json({ ok: true, briefing });
}
