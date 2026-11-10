import Link from "next/link";
import { AuthButton } from "./AuthButton";

export function Header() {
  const today = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white font-bold">
            CB
          </span>
          <div className="leading-tight">
            <div className="text-lg font-semibold">Career Briefing</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {today}
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/archive">아카이브</NavLink>
          <NavLink href="/saved">저장한 뉴스</NavLink>
          <NavLink href="/settings">설정</NavLink>
          <NavLink href="/admin">관리자</NavLink>
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}
