import { NextResponse } from "next/server";
import { isAuthConfigured, isAuthenticated } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 현재 인증 상태 조회 (키 값 미노출) */
export async function GET(req: Request) {
  return NextResponse.json({
    authenticated: isAuthenticated(req),
    authConfigured: isAuthConfigured(),
  });
}
