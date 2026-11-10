import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { checkCron } from "@/lib/auth";
import { getRepository } from "@/lib/repo";
import { runIngest } from "@/lib/services/ingest";
import { analyzeBriefing } from "@/lib/services/analysis";
import { getOrCreateBriefing, todayKst } from "@/lib/services/briefing";
import type { IngestionJob } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron 진입점: 수집 -> 선정 -> 분석 순차 실행.
 * Vercel Cron은 GET으로 호출하므로 GET/POST 모두 허용.
 */
async function handle(req: Request) {
  const auth = checkCron(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const date = todayKst();

  const ingest = await runIngest({ sinceHours: 48 });
  const briefing = await getOrCreateBriefing({ date, count: 3 });
  const analysis = await analyzeBriefing(date, 0, "simple");

  const job: IngestionJob = {
    id: randomUUID(),
    kind: "cron",
    status: ingest.job.status === "failed" ? "failed" : "success",
    stats: {
      ingested: ingest.inserted,
      fetched: ingest.fetched,
      selected: briefing.items.length,
      analyzed: analysis.analyzed.length,
    },
    error: ingest.errors.length ? ingest.errors.slice(0, 5).join(" | ") : null,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
  try {
    await getRepository().saveJob(job);
  } catch {
    /* ignore */
  }

  return NextResponse.json({ ok: true, job, date });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
