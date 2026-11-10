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
      <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
        <div className="card animate-fade-in-up p-7">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-xl dark:bg-brand/15">
            🔒
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">로그인</h1>
          <p className="mb-6 mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            개인용 서비스입니다. AI 분석을 실행하려면 로그인하세요. 뉴스 목록
            탐색은 로그인 없이 가능합니다.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand/50 focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-900"
                placeholder="비밀번호 입력"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !password}
              className="btn-primary w-full py-2.5"
            >
              {busy ? "확인 중..." : "로그인"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
