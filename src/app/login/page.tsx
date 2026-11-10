"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { login } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await login(password);
    setBusy(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError(res.error ?? "로그인 실패");
    }
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="mb-2 text-2xl font-bold">로그인</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          개인용 서비스입니다. AI 분석을 실행하려면 로그인하세요. 뉴스 목록
          탐색은 로그인 없이 가능합니다.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              placeholder="APP_PASSWORD"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-fg disabled:opacity-50"
          >
            {busy ? "확인 중..." : "로그인"}
          </button>
        </form>
      </main>
    </>
  );
}
