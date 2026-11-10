import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { getLlmConfig } from "@/lib/env";
import { listModels } from "@/lib/ai/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LLM 게이트웨이 연결/모델 접근 사전 점검.
 * 분석(대량 호출) 전에 모델 목록을 조회해 지정 모델 사용 가능 여부만 확인한다.
 * 키 값은 응답에 포함하지 않는다.
 */
export async function GET(req: Request) {
  const auth = checkAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 });
  }

  const cfg = getLlmConfig();
  if (!cfg) {
    return NextResponse.json(
      { ok: false, reason: "LLM_API_KEY 미설정" },
      { status: 200 },
    );
  }

  const url = new URL(req.url);
  const wanted = url.searchParams.get("model") ?? cfg.model;

  const result = await listModels(cfg);
  const available = result.models.includes(wanted);

  return NextResponse.json({
    ok: result.ok,
    httpStatus: result.status,
    baseUrl: cfg.baseUrl,
    configuredModel: cfg.model,
    jsonMode: cfg.jsonMode,
    wantedModel: wanted,
    modelAvailable: available,
    modelCount: result.models.length,
    // 모델 이름이 매우 많을 수 있어 매칭/유사 후보만 노출
    sampleModels: result.models
      .filter((m) => m.toLowerCase().includes("claude") || m === wanted)
      .slice(0, 20),
    error: result.error ?? null,
  });
}
