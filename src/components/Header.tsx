import Link from "next/link";
import { AuthButton } from "./AuthButton";
import { MobileNav } from "./MobileNav";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-indigo-400 text-sm font-bold text-white shadow-sm">
            CB
          </span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[15px] font-bold tracking-tight">
              Career Briefing
            </div>
            <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">
              취업 준비 뉴스 · AI 분석
            </div>
          </div>
        </Link>

        {/* 데스크톱 내비게이션 */}
        <nav className="hidden items-center gap-0.5 text-sm sm:flex">
          <NavLink href="/saved">저장</NavLink>
          <NavLink href="/archive">아카이브</NavLink>
          <NavLink href="/settings">설정</NavLink>
          <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <AuthButton />
        </nav>

        {/* 모바일 내비게이션 (로그인 버튼 + 햄버거 메뉴) */}
        <div className="flex items-center gap-1.5 sm:hidden">
          <AuthButton />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap rounded-lg px-3 py-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}
