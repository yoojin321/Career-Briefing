import { getRepository } from "@/lib/repo";

/**
 * 네이버 검색 API 무료 사용량 보호.
 *
 * 공식 문서 기준 검색 API 하루 호출 한도는 25,000회이며, 무료 할당량을
 * 초과한 호출만 종량제로 과금된다. 본 서비스는 무료 범위를 절대 넘지 않도록
 * 그보다 훨씬 보수적인 자체 상한을 둔다.
 *
 * - 1회 수집(ingest)당 호출 상한: maxCallsPerIngest()
 * - 하루 누적 호출 상한: dailyCallCap() (무료 25,000의 극히 일부)
 *
 * 영속성: Supabase가 설정돼 있으면 api_usage 테이블에 일일 호출량을 저장하여
 * 서버를 재시작해도 그날의 누적 사용량이 유지된다. Supabase가 없으면
 * 인메모리 저장소(프로세스 메모리)로 동작한다.
 */

export const NAVER_PROVIDER = "naver";
/** 네이버 공식 무료 일일 한도(참고용, 초과 금지 기준) */
export const NAVER_FREE_DAILY_LIMIT = 25_000;

function readIntEnv(name: string, fallback: number, hardMax: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, hardMax);
}

/** 1회 ingest에서 네이버에 보낼 수 있는 최대 호출 수 (기본 25, 하드맥스 200) */
export function maxCallsPerIngest(): number {
  return readIntEnv("NAVER_MAX_CALLS_PER_INGEST", 25, 200);
}

/**
 * 하루 누적 호출 상한. 무료 한도(25,000)의 작은 일부로 제한한다.
 * 기본 500, 하드맥스 5,000 (무료 한도의 20%) — 절대 무료 범위를 넘지 않음.
 */
export function dailyCallCap(): number {
  return readIntEnv("NAVER_DAILY_CALL_CAP", 500, 5_000);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 남은 일일 호출 가능 수 (영속 저장소 기준) */
export async function remainingDailyCalls(): Promise<number> {
  try {
    const used = await getRepository().getApiUsage(NAVER_PROVIDER, today());
    return Math.max(0, dailyCallCap() - used);
  } catch {
    // 저장소 조회 실패 시 보수적으로 0을 반환하지 않고 상한을 반환(수집 자체는 가능)
    return dailyCallCap();
  }
}

/**
 * 호출 n회를 기록하고, 상한 초과 시 false 반환(호출 금지).
 * 원자적 증가(Supabase RPC) 후 누적값으로 판정한다.
 */
export async function tryConsume(n: number): Promise<boolean> {
  try {
    const total = await getRepository().incrementApiUsage(
      NAVER_PROVIDER,
      today(),
      n,
    );
    return total <= dailyCallCap();
  } catch {
    // 저장소 오류 시 안전하게 호출을 막는다(요금 방지 우선)
    return false;
  }
}

/** 현재 사용량 요약 (관리자 표시용) */
export async function usageSnapshot() {
  let usedToday = 0;
  try {
    usedToday = await getRepository().getApiUsage(NAVER_PROVIDER, today());
  } catch {
    /* ignore */
  }
  return {
    date: today(),
    usedToday,
    dailyCap: dailyCallCap(),
    maxPerIngest: maxCallsPerIngest(),
    freeDailyLimit: NAVER_FREE_DAILY_LIMIT,
  };
}
