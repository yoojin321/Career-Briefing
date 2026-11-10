import { NextResponse } from "next/server";
import { getRepository } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 아카이브: 브리핑이 존재하는 날짜 목록 */
export async function GET() {
  const repo = getRepository();
  const dates = await repo.listBriefingDates(60);
  return NextResponse.json({ dates });
}
