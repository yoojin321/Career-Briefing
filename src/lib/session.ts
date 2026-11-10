import { createHmac, timingSafeEqual } from "node:crypto";
import { getAppPassword, getSessionSecret } from "@/lib/env";

/**
 * 개인용 최소 세션: HMAC 서명 토큰을 HttpOnly 쿠키에 저장.
 * 외부 의존성 없이 Node crypto만 사용. 토큰 형식: base64url(payload).signature
 * payload = { exp: epochMillis }
 */

export const SESSION_COOKIE = "cb_session";
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 12; // 12시간

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payload).digest());
}

/** 세션 토큰 생성 (서버 전용) */
export function issueSessionToken(ttlMs = DEFAULT_TTL_MS): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  const payload = b64url(JSON.stringify({ exp: Date.now() + ttlMs }));
  const sig = sign(payload, secret);
  return `${payload}.${sig}`;
}

/** 토큰 검증: 서명 일치 + 만료 전 */
export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const secret = getSessionSecret();
  if (!secret) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload, secret);
  // 타이밍 안전 비교
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;
  try {
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(),
    ) as { exp?: number };
    return typeof decoded.exp === "number" && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

/** 비밀번호 검증 (타이밍 안전) */
export function verifyPassword(input: string): boolean {
  const expected = getAppPassword();
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** 요청 쿠키에서 세션을 읽어 인증 여부 반환 */
export function isAuthenticated(req: Request): boolean {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return false;
  const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  return verifySessionToken(token);
}

/** 인증 설정이 되어 있는지(비밀번호+시크릿 모두 존재) */
export function isAuthConfigured(): boolean {
  return getAppPassword() !== null && getSessionSecret() !== null;
}

/** Set-Cookie 헤더 값 생성 (HttpOnly, SameSite=Lax, 프로덕션 Secure) */
export function sessionCookieHeader(
  token: string,
  ttlMs = DEFAULT_TTL_MS,
): string {
  const maxAge = Math.floor(ttlMs / 1000);
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(
    token,
  )}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${maxAge}`;
}

/** 로그아웃용 만료 쿠키 */
export function clearSessionCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=0`;
}
