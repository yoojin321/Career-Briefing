import Link from "next/link";
import type { Article, AnalysisStatus } from "@/lib/types";
import { categoryColor, categoryLabel, formatDateTime } from "@/lib/format";

const STATUS_BADGE: Record<string, { text: string; className: string }> = {
  completed: {
    text: "AI 분석 완료",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  failed: {
    text: "분석 실패",
    className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
  unconfigured: {
    text: "AI 미설정",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
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
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColor(
            article.category,
          )}`}
        >
          {categoryLabel(article.category)}
        </span>
        {badge ? (
          <span className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}>
            {badge.text}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            분석 전
          </span>
        )}
      </div>

      <Link href={`/news/${article.id}`} className="group">
        <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug group-hover:text-brand">
          {article.title}
        </h3>
      </Link>

      {article.description ? (
        <p className="mb-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
          {article.description}
        </p>
      ) : (
        <p className="mb-3 text-sm italic text-slate-400">공식 요약 없음</p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="truncate">
          {article.sourceName ?? "출처 미상"} · {formatDateTime(article.publishedAt)}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-brand"
            onClick={(e) => e.stopPropagation()}
          >
            원문 ↗
          </a>
          <Link
            href={`/news/${article.id}`}
            className="rounded-md bg-brand px-2.5 py-1 font-medium text-white hover:bg-brand-fg"
          >
            AI 분석
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ArticleCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="mb-2 h-5 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mb-4 h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}
