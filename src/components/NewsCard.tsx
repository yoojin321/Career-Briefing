import Link from "next/link";
import type { Article, BriefingItem, AnalysisStatus } from "@/lib/types";
import { categoryColor, categoryLabel, formatDate } from "@/lib/format";

const STATUS_BADGE: Record<string, { text: string; className: string }> = {
  completed: {
    text: "AI 분석 완료",
    className: "bg-emerald-100 text-emerald-700",
  },
  pending: { text: "분석 대기", className: "bg-slate-100 text-slate-600" },
  failed: { text: "분석 실패", className: "bg-rose-100 text-rose-700" },
  unconfigured: {
    text: "AI 미설정",
    className: "bg-amber-100 text-amber-700",
  },
};

export function NewsCard({
  item,
  article,
  analysisStatus,
}: {
  item: BriefingItem;
  article: Article;
  analysisStatus: AnalysisStatus | null;
}) {
  const badge = analysisStatus ? STATUS_BADGE[analysisStatus] : null;

  return (
    <Link
      href={`/news/${article.id}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColor(
            article.category,
          )}`}
        >
          {categoryLabel(article.category)}
        </span>
        <span className="text-xs font-semibold text-brand">#{item.rank}</span>
      </div>

      <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug group-hover:text-brand">
        {article.title}
      </h3>

      {article.description ? (
        <p className="mb-3 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">
          {article.description}
        </p>
      ) : (
        <p className="mb-3 line-clamp-3 text-sm italic text-slate-400">
          공식 요약 메타 없음 — 상세에서 제한적 분석 제공
        </p>
      )}

      <div className="mt-auto space-y-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          선정 사유: {item.reason}
        </p>
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {article.sourceName ?? "출처 미상"} · {formatDate(article.publishedAt)}
          </span>
          {badge && (
            <span className={`rounded-full px-2 py-0.5 ${badge.className}`}>
              {badge.text}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function NewsCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 h-5 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="mb-2 h-5 w-full rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mb-4 h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-16 rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}
