import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { usageSnapshot } from "@/lib/sources/naver-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 네이버 API 일일 호출량 조회 (영속 저장소 기준). 추가 호출을 발생시키지 않음. */
export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }
  return NextResponse.json(await usageSnapshot());
}
