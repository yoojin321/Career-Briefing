"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ArticleCard, ArticleCardSkeleton } from "@/components/ArticleCard";
import {
  type NewsListItem,
  fetchArchiveByDate,
  fetchArchiveDates,
} from "@/lib/api-client";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";
import { getBookmarkedIds } from "@/lib/settings";
import { formatDate } from "@/lib/format";

export default function ArchivePage() {
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [items, setItems] = useState<NewsListItem[]>([]);
  const [datesLoading, setDatesLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "ALL">("ALL");
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  // 분석 완료 날짜 목록 로드
  useEffect(() => {
    (async () => {
      setDatesLoading(true);
      setError(null);
      try {
        const res = await fetchArchiveDates();
        if (res.unauthorized) {
          setUnauthorized(true);
          return;
        }
        setDates(res.dates);
        if (res.dates.length) setSelected(res.dates[0]);
        setBookmarks(getBookmarkedIds());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setDatesLoading(false);
      }
    })();
  }, []);

  // 선택 날짜의 분석 완료 기사 로드
  useEffect(() => {
    if (!selected) return;
    let active = true;
    (async () => {
      setItemsLoading(true);
      try {
        const list = await fetchArchiveByDate(selected);
        if (active) setItems(list);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setItemsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selected]);

  const entries = useMemo(() => {
    let list = items;
    if (catFilter !== "ALL")
      list = list.filter((e) => e.article.category === catFilter);
    if (bookmarkOnly)
      list = list.filter((e) => bookmarks.includes(e.article.id));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (e) =>
          e.article.title.toLowerCase().includes(q) ||
          (e.article.description ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, catFilter, bookmarkOnly, bookmarks, query]);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        <div className="mb-6">
          <p className="eyebrow mb-2">LEARNING ARCHIVE</p>
          <h1 className="text-[28px] font-extrabold tracking-tight">학습 아카이브</h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            AI 분석을 완료한 기사를 분석한 날짜별로 모아 복습합니다.
          </p>
        </div>

        {/* 로그인 필요 */}
        {!datesLoading && unauthorized && (
          <div className="card p-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-2xl dark:bg-brand/15">
              🔒
            </div>
            <p className="text-base font-semibold">로그인 후 이용할 수 있습니다</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              학습 아카이브는 분석한 기록을 모아 보여주므로 로그인이 필요합니다.
            </p>
            <Link href="/login" className="btn-primary mt-5 px-6">
              로그인하기
            </Link>
          </div>
        )}

        {/* 날짜 목록 로딩 */}
        {datesLoading && (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
            아카이브를 불러오는 중…
          </div>
        )}

        {!datesLoading && !unauthorized && error && (
          <div className="card border-rose-200 bg-rose-50/60 p-8 text-center text-rose-700 dark:border-rose-900 dark:bg-rose-950/30">
            {error}
          </div>
        )}

        {!datesLoading && !unauthorized && !error && dates.length === 0 && (
          <div className="card p-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800">
              🗂️
            </div>
            <p className="text-base font-semibold">아직 분석한 기사가 없습니다</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              기사 상세에서 "AI 분석 실행"을 하면, 분석한 날짜별로 여기에 쌓여
              복습할 수 있습니다.
            </p>
            <Link href="/" className="btn-ghost mt-5 px-6">
              뉴스 탐색하러 가기
            </Link>
          </div>
        )}

        {!datesLoading && !unauthorized && !error && dates.length > 0 && (
          <>
            {/* 날짜 선택 (드롭다운) + 필터 */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">날짜</span>
                <select
                  value={selected ?? ""}
                  onChange={(e) => setSelected(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {dates.map((d) => (
                    <option key={d} value={d}>
                      {formatDate(d)}
                    </option>
                  ))}
                </select>
              </label>

              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value as Category | "ALL")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
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
                placeholder="키워드 검색 (이 날짜 내)"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand/50 focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-900"
              />

              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={bookmarkOnly}
                  onChange={(e) => setBookmarkOnly(e.target.checked)}
                />
                북마크만
              </label>
            </div>

            {/* 기사 로딩 / 목록 */}
            {itemsLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ArticleCardSkeleton key={i} />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="card p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                조건에 맞는 기사가 없습니다.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((e) => (
                  <div key={e.article.id} className="animate-fade-in-up">
                    <ArticleCard
                      article={e.article}
                      analysisStatus={e.analysisStatus}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
