import { NextResponse } from "next/server";
import {
  isAuthConfigured,
  issueSessionToken,
  sessionCookieHeader,
  verifyPassword,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 개인용 비밀번호 로그인. 성공 시 HttpOnly 세션 쿠키 발급. */
export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "로그인이 구성되지 않았습니다. 서버에 APP_PASSWORD와 SESSION_SECRET을 설정하세요.",
      },
      { status: 503 },
    );
  }

  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    /* ignore */
  }

  if (!password || !verifyPassword(password)) {
    // 비밀번호 틀림 — 상세 이유를 주지 않음
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const token = issueSessionToken();
  if (!token) {
    return NextResponse.json(
      { error: "세션 생성 실패(SESSION_SECRET 미설정)" },
      { status: 503 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", sessionCookieHeader(token));
  return res;
}
