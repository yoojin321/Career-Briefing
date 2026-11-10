/**
 * 서버 전용 환경변수 접근 헬퍼.
 * 키가 없을 때 throw 하지 않고 "미설정" 상태를 노출한다.
 * (요구사항: 키가 없는 기능은 가짜 데이터로 대체하지 않고 명시적으로 미설정 처리)
 */

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface NaverConfig {
  clientId: string;
  clientSecret: string;
  /** "hub" = NCP API HUB(naverapihub.apigw.ntruss.com), "developers" = 구형 openapi.naver.com */
  mode: "hub" | "developers";
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** response_format=json_object 전송 여부. Claude 프록시 호환성 위해 기본 false */
  jsonMode: boolean;
}

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  // 서버 전용 SUPABASE_URL을 우선 사용(클라이언트 번들 미노출).
  // 하위 호환을 위해 NEXT_PUBLIC_SUPABASE_URL도 허용한다.
  const url = read("SUPABASE_URL") ?? read("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = read("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

export function getNaverConfig(): NaverConfig | null {
  const clientId = read("NAVER_CLIENT_ID");
  const clientSecret = read("NAVER_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  const mode = read("NAVER_API_MODE") === "developers" ? "developers" : "hub";
  return { clientId, clientSecret, mode };
}

export function getLlmConfig(): LlmConfig | null {
  const apiKey = read("LLM_API_KEY");
  if (!apiKey) return null;
  return {
    baseUrl: read("LLM_API_BASE_URL") ?? "https://api.openai.com/v1",
    apiKey,
    model: read("LLM_MODEL") ?? "gpt-4o-mini",
    jsonMode: read("LLM_JSON_MODE") === "1",
  };
}

export function getAdminSecret(): string | null {
  return read("ADMIN_SECRET") ?? null;
}

export function getCronSecret(): string | null {
  return read("CRON_SECRET") ?? null;
}

/** 개인용 로그인 비밀번호 (분석 등 보호 기능 접근용) */
export function getAppPassword(): string | null {
  return read("APP_PASSWORD") ?? null;
}

/** 세션 쿠키 서명용 비밀키. 미설정 시 ADMIN_SECRET로 폴백(그래도 없으면 null) */
export function getSessionSecret(): string | null {
  return read("SESSION_SECRET") ?? read("ADMIN_SECRET") ?? null;
}

/** 전체 설정 상태 요약 (관리자 UI/상태 배너용) */
export function getConfigStatus() {
  return {
    supabase: getSupabaseConfig() !== null,
    naver: getNaverConfig() !== null,
    llm: getLlmConfig() !== null,
    adminSecret: getAdminSecret() !== null,
  };
}
