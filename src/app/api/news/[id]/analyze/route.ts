import { NextResponse } from "next/server";
import { analyzeOnDemand } from "@/lib/services/analysis";
import { isAuthConfigured, isAuthenticated } from "@/lib/session";
import type { AnalysisDepth } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 인증 사용자 전용 단일 기사 AI 분석.
 * - 인증되지 않은 요청은 BAZE 호출 전에 401로 차단
 * - 기존 completed 분석이 있으면 BAZE 재호출 없이 즉시 반환
 * - 동시 요청은 서버 잠금으로 중복 분석 방지
 * - 일일 분석 상한 초과 시 429
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 인증 게이트: 분석(비용 발생)은 로그인 사용자만.
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "분석 기능이 보호되지 않았습니다. 서버에 APP_PASSWORD/SESSION_SECRET을 설정하세요.",
      },
      { status: 503 },
    );
  }
  if (!isAuthenticated(req)) {
    return NextResponse.json(
      { error: "로그인이 필요합니다.", status: "unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  let depth: AnalysisDepth = "simple";
  try {
    const body = await req.json();
    if (body?.depth === "detailed") depth = "detailed";
  } catch {
    /* 본문 없음 허용 */
  }

  const outcome = await analyzeOnDemand(id, depth);

  switch (outcome.status) {
    case "not_found":
      return NextResponse.json(
        { error: "기사를 찾을 수 없습니다" },
        { status: 404 },
      );
    case "capped":
      return NextResponse.json(
        {
          error:
            "오늘 AI 분석 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.",
          status: "capped",
        },
        { status: 429 },
      );
    case "locked":
      return NextResponse.json(
        {
          status: "locked",
          message: "다른 요청이 분석 중입니다. 잠시 후 다시 시도하세요.",
          analysis: outcome.analysis,
        },
        { status: 202 },
      );
    default:
      return NextResponse.json({
        status: outcome.status,
        analysis: outcome.analysis,
      });
  }
}
