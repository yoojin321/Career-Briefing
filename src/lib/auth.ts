import { getAdminSecret, getCronSecret } from "@/lib/env";

/**
 * 관리자 요청 인증. ADMIN_SECRET 미설정이면 관리자 기능을 비활성(401)한다.
 * (개발 중 보호 없이 노출되는 것을 방지)
 */
export function checkAdmin(req: Request): { ok: boolean; reason?: string } {
  const secret = getAdminSecret();
  if (!secret) {
    return { ok: false, reason: "ADMIN_SECRET 미설정: 관리자 기능 비활성화" };
  }
  const header =
    req.headers.get("x-admin-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (header !== secret) return { ok: false, reason: "인증 실패" };
  return { ok: true };
}

/** Cron 요청 인증 (Vercel Cron은 Authorization: Bearer <CRON_SECRET>) */
export function checkCron(req: Request): { ok: boolean; reason?: string } {
  const secret = getCronSecret();
  if (!secret) return { ok: false, reason: "CRON_SECRET 미설정" };
  const header = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const alt = req.headers.get("x-cron-secret");
  if (header !== secret && alt !== secret)
    return { ok: false, reason: "인증 실패" };
  return { ok: true };
}
