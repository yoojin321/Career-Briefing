import Link from "next/link";
import type { Article, AnalysisStatus } from "@/lib/types";
import { categoryColor, categoryLabel, formatDateTime } from "@/lib/format";

const STATUS_BADGE: Record<string, { text: string; className: string }> = {
  completed: {
    text: "AI 분석 완료",
    className:
      "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  failed: {
    text: "분석 실패",
    className:
      "bg-rose-50 text-rose-600 ring-1 ring-rose-500/20 dark:bg-rose-900/30 dark:text-rose-300",
  },
  unconfigured: {
    text: "AI 미설정",
    className:
      "bg-amber-50 text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-900/30 dark:text-amber-300",
  },
};

/** 탐색용 뉴스 카드. 발행일시·출처·공식 요약·원문 링크·분석 상태 표시. */
export function ArticleCard({
  article,
  analysisStatus,
}: {
  article: Article;
  analysisStatus: AnalysisStatus | null;
}) {
  const badge = analysisStatus ? STATUS_BADGE[analysisStatus] : null;

  return (
    <article className="card card-hover group flex flex-col overflow-hidden">
      <Link href={`/news/${article.id}`} className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryColor(
              article.category,
            )}`}
          >
            {categoryLabel(article.category)}
          </span>
          {badge ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
            >
              {badge.text}
            </span>
          ) : (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-400 ring-1 ring-slate-200 dark:text-slate-500 dark:ring-slate-700">
              분석 전
            </span>
          )}
        </div>

        <h3 className="mb-2 line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-slate-900 transition group-hover:text-brand dark:text-slate-100">
          {article.title}
        </h3>

        {article.description ? (
          <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {article.description}
          </p>
        ) : (
          <p className="mb-4 text-sm italic text-slate-400">공식 요약 없음</p>
        )}

        <div className="mt-auto flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <span className="truncate font-medium text-slate-500 dark:text-slate-400">
            {article.sourceName ?? "출처 미상"}
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="shrink-0">{formatDateTime(article.publishedAt)}</span>
        </div>
      </Link>

      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2.5 dark:border-slate-800">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-slate-400 transition hover:text-brand"
        >
          원문 보기 ↗
        </a>
        <Link
          href={`/news/${article.id}`}
          className="text-xs font-semibold text-brand transition hover:text-brand-fg"
        >
          AI 분석 →
        </Link>
      </div>
    </article>
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="card animate-pulse p-5">
      <div className="mb-3 flex justify-between">
        <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="h-5 w-12 rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="mb-2 h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mb-4 h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mb-2 h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
      <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}
