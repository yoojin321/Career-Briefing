"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { fetchArticle } from "@/lib/api-client";
import { getBookmarkedIds, getLearnedIds } from "@/lib/settings";
import {
  categoryColor,
  categoryLabel,
  formatDate,
} from "@/lib/format";
import type { Article } from "@/lib/types";

type Tab = "bookmarks" | "learned";

export default function SavedPage() {
  const [tab, setTab] = useState<Tab>("bookmarks");
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ids = tab === "bookmarks" ? getBookmarkedIds() : getLearnedIds();
      const results = await Promise.all(
        ids.map((id) => fetchArticle(id).catch(() => null)),
      );
      setArticles(
        results
          .map((r) => r?.article)
          .filter((a): a is Article => a != null),
      );
      setLoading(false);
    })();
  }, [tab]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">저장한 뉴스</h1>

        <div className="mb-6 flex gap-2">
          <TabButton active={tab === "bookmarks"} onClick={() => setTab("bookmarks")}>
            ★ 북마크
          </TabButton>
          <TabButton active={tab === "learned"} onClick={() => setTab("learned")}>
            ✓ 학습 완료
          </TabButton>
        </div>

        {loading && <p className="text-slate-500">불러오는 중...</p>}
        {!loading && articles.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            {tab === "bookmarks"
              ? "북마크한 뉴스가 없습니다."
              : "학습 완료로 표시한 뉴스가 없습니다."}
          </p>
        )}
        {!loading && articles.length > 0 && (
          <ul className="space-y-3">
            {articles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/news/${a.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColor(
                      a.category,
                    )}`}
                  >
                    {categoryLabel(a.category)}
                  </span>
                  <span className="flex-1 font-medium">{a.title}</span>
                  <span className="text-xs text-slate-400">
                    {formatDate(a.publishedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-brand text-white"
          : "border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
