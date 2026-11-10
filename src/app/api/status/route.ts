import { NextResponse } from "next/server";
import { getConfigStatus } from "@/lib/env";
import { getRepositoryKind } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 설정 상태 (키/저장소 종류). 시크릿 값은 노출하지 않고 설정 여부만 반환. */
export async function GET() {
  return NextResponse.json({
    config: getConfigStatus(),
    repository: getRepositoryKind(),
  });
}
