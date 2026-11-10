import type { StatusResponse } from "@/lib/api-client";

/** 미설정 키 안내 배너. 가짜 데이터 대신 정확한 설정 안내를 제공. */
export function StatusBanner({ status }: { status: StatusResponse }) {
  const missing: string[] = [];
  if (!status.config.naver) missing.push("네이버 뉴스 API");
  if (!status.config.llm) missing.push("LLM API");
  if (!status.config.supabase) missing.push("Supabase");
  if (!status.config.adminSecret) missing.push("ADMIN_SECRET");

  if (missing.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <p className="font-semibold">설정이 필요한 항목이 있습니다</p>
      <p className="mt-1">
        미설정: {missing.join(", ")}. 해당 기능은 비활성 상태이며, 실제 데이터가
        없을 때 임의 뉴스를 표시하지 않습니다.{" "}
        {status.repository === "memory" &&
          "현재 저장소는 메모리 모드(개발용, 서버 재시작 시 초기화)입니다. "}
        <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">
          .env.example
        </code>{" "}
        를 참고해 환경변수를 설정하세요.
      </p>
    </div>
  );
}
