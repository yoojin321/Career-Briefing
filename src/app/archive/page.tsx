"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { NewsCard } from "@/components/NewsCard";
import {
  type BriefingResponse,
  fetchBriefing,
} from "@/lib/api-client";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";
import { getBookmarkedIds } from "@/lib/settings";

export default function ArchivePage() {
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "ALL">("ALL");
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/archive", { cache: "no-store" });
      const json = (await res.json()) as { dates: string[] };
      setDates(json.dates);
      if (json.dates.length) setSelected(json.dates[0]);
      setBookmarks(getBookmarkedIds());
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      setData(await fetchBriefing(selected, 0));
    })();
  }, [selected]);

  const entries = useMemo(() => {
    let list = (data?.articles ?? []).filter((e) => e.article);
    if (catFilter !== "ALL")
      list = list.filter((e) => e.article!.category === catFilter);
    if (bookmarkOnly)
      list = list.filter((e) => bookmarks.includes(e.article!.id));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (e) =>
          e.article!.title.toLowerCase().includes(q) ||
          (e.article!.description ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, catFilter, bookmarkOnly, bookmarks, query]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">뉴스 아카이브</h1>

        {!loading && dates.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            저장된 브리핑이 없습니다. 관리자 페이지에서 수집/선정을 실행하세요.
          </p>
        )}

        {dates.length > 0 && (
          <>
            <div className="mb-4 flex flex-wrap gap-3">
              <select
                value={selected ?? ""}
                onChange={(e) => setSelected(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value as Category | "ALL")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="ALL">전체 카테고리</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="키워드 검색"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bookmarkOnly}
                  onChange={(e) => setBookmarkOnly(e.target.checked)}
                />
                북마크만
              </label>
            </div>

            {entries.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                조건에 맞는 뉴스가 없습니다.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((e) => (
                  <NewsCard
                    key={e.article!.id}
                    item={e.item}
                    article={e.article!}
                    analysisStatus={e.analysisStatus}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
