"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { type AuthState, fetchAuth, logout } from "@/lib/api-client";

/** 로그인/로그아웃 버튼. 인증 미구성 시 아무것도 표시하지 않음. */
export function AuthButton() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    fetchAuth().then(setAuth).catch(() => {});
  }, []);

  if (!auth || !auth.authConfigured) return null;

  if (auth.authenticated) {
    return (
      <button
        onClick={async () => {
          await logout();
          setAuth({ ...auth, authenticated: false });
          router.refresh();
        }}
        className="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        로그아웃
      </button>
    );
  }

  return (
    <Link
      href="/login"
      className="rounded-md bg-brand px-3 py-1.5 font-medium text-white transition hover:bg-brand-fg"
    >
      로그인
    </Link>
  );
}
