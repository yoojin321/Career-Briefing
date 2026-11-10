"use client";

import { useState } from "react";
import { Header } from "@/components/Header";

type Step = "ingest" | "select" | "analyze" | "cron";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [count, setCount] = useState(3);
  const [depth, setDepth] = useState<"simple" | "detailed">("simple");
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const log = (msg: string) =>
    setLogs((l) => [`${new Date().toLocaleTimeString("ko-KR")}  ${msg}`, ...l]);

  async function call(step: Step) {
    if (!secret) {
      log("⚠ ADMIN_SECRET를 입력하세요");
      return;
    }
    setBusy(true);
    const endpoints: Record<Step, { url: string; body?: unknown }> = {
      ingest: { url: "/api/ingest", body: { sinceHours: 48 } },
      select: { url: "/api/select", body: { count } },
      analyze: { url: "/api/analyze", body: { depth } },
      cron: { url: "/api/cron", body: undefined },
    };
    const { url, body } = endpoints[step];
    try {
      log(`▶ ${step} 요청...`);
      const res = await fetch(url, {
        method: step === "cron" ? "POST" : "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
          ...(step === "cron" ? { "x-cron-secret": secret } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      log(`${res.ok ? "✓" : "✗"} ${step} [${res.status}] ${JSON.stringify(json)}`);
    } catch (e) {
      log(`✗ ${step} 오류: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold">관리자 — 수동 실행</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          스케줄러가 없거나 실패해도 여기서 수집 → 선정 → 분석을 수동 실행할 수
          있습니다. 요청은 ADMIN_SECRET로 보호됩니다. (Cron 버튼은 CRON_SECRET =
          입력값 가정)
        </p>

        <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <label className="block text-sm font-medium">
            ADMIN_SECRET
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="서버 .env의 ADMIN_SECRET"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <div className="flex gap-4">
            <label className="text-sm font-medium">
              뉴스 개수
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="text-sm font-medium">
              분석 깊이
              <select
                value={depth}
                onChange={(e) => setDepth(e.target.value as "simple" | "detailed")}
                className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="simple">간단</option>
                <option value="detailed">상세</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ActionButton disabled={busy} onClick={() => call("ingest")}>
            1. 수집
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => call("select")}>
            2. 선정
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => call("analyze")}>
            3. 분석
          </ActionButton>
          <ActionButton disabled={busy} onClick={() => call("cron")}>
            전체 (Cron)
          </ActionButton>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 dark:border-slate-800">
          <div className="mb-2 text-xs font-semibold text-slate-400">실행 로그</div>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs text-emerald-300">
            {logs.length ? logs.join("\n") : "아직 실행 기록이 없습니다."}
          </pre>
        </div>
      </main>
    </>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-fg disabled:opacity-50"
    >
      {children}
    </button>
  );
}
