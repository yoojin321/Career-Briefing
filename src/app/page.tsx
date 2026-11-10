"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ArticleCard, ArticleCardSkeleton } from "@/components/ArticleCard";
import { StatusBanner } from "@/components/StatusBanner";
import {
  type NewsListItem,
  type StatusResponse,
  fetchNews,
  fetchStatus,
} from "@/lib/api-client";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";

const PAGE_SIZE = 12;

export default function HomePage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [category, setCategory] = useState<Category>("IT_AI");
  const [items, setItems] = useState<NewsListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const reqId = useRef(0);

  useEffect(() => {
    fetchStatus().then(setStatus).catch(() => {});
  }, []);

  const loadPage = useCallback(
    async (cat: Category, p: number, q: string, force: boolean) => {
      const myReq = ++reqId.current;
      if (p === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await fetchNews({
          category: q ? undefined : cat,
          q: q || undefined,
          page: p,
          pageSize: PAGE_SIZE,
          force,
        });
        // 최신 요청만 반영 (카테고리 빠른 전환 경쟁 방지)
        if (myReq !== reqId.current) return;
        setItems((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
        setHasMore(res.hasMore);
        setPage(res.page);
        if (res.refreshError) setRefreshNote(`수집 경고: ${res.refreshError}`);
        else if (res.refreshed) setRefreshNote("최신 뉴스를 수집했습니다.");
        else setRefreshNote(null);
      } catch (e) {
        if (myReq === reqId.current) setError((e as Error).message);
      } finally {
        if (myReq === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  // 카테고리/검색 변경 시 1페이지부터 로드
  useEffect(() => {
    loadPage(category, 1, activeQuery, false);
  }, [category, activeQuery, loadPage]);

  function onManualRefresh() {
    setRefreshing(true);
    loadPage(category, 1, activeQuery, true);
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveQuery(query.trim());
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {status && <StatusBanner status={status} />}

        <div className="mb-5">
          <h1 className="text-2xl font-bold">분야별 최신 뉴스</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            관심 분야를 선택해 최신순으로 탐색하고, 기사를 클릭하면 AI 분석을
            실행합니다.
          </p>
        </div>

        {/* 카테고리 탭 */}
        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => {
                setActiveQuery("");
                setQuery("");
                setCategory(c);
              }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                category === c && !activeQuery
                  ? "bg-brand text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {/* 검색 + 새로고침 */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <form onSubmit={onSearch} className="flex flex-1 gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="뉴스 검색 (제목·요약)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              검색
            </button>
            {activeQuery && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveQuery("");
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
              >
                초기화
              </button>
            )}
          </form>
          <button
            onClick={onManualRefresh}
            disabled={refreshing || !!activeQuery}
            className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-fg disabled:opacity-50"
            title={activeQuery ? "검색 중에는 비활성화" : "최신 뉴스 수동 수집"}
          >
            {refreshing ? "새로고침 중..." : "새로고침"}
          </button>
        </div>

        {refreshNote && (
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            {refreshNote}
          </p>
        )}

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ArticleCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900 dark:bg-rose-950/40">
            <p className="font-semibold text-rose-700 dark:text-rose-300">
              뉴스를 불러오지 못했습니다
            </p>
            <p className="mt-1 text-sm text-rose-600">{error}</p>
            <button
              onClick={() => loadPage(category, 1, activeQuery, false)}
              className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="text-lg font-semibold">표시할 뉴스가 없습니다</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {activeQuery
                ? "검색 결과가 없습니다. 다른 키워드를 시도하세요."
                : "아직 수집된 기사가 없습니다. 새로고침을 누르거나 관리자 페이지에서 수집하세요."}
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => (
                <ArticleCard
                  key={it.article.id}
                  article={it.article}
                  analysisStatus={it.analysisStatus}
                />
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              {hasMore ? (
                <button
                  onClick={() =>
                    loadPage(category, page + 1, activeQuery, false)
                  }
                  disabled={loadingMore}
                  className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-medium transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {loadingMore ? "불러오는 중..." : "기사 더 보기"}
                </button>
              ) : (
                <p className="text-xs text-slate-400">마지막 기사입니다</p>
              )}
            </div>
          </>
        )}

        <footer className="mt-12 flex flex-wrap gap-3 border-t border-slate-200 pt-6 text-sm dark:border-slate-800">
          <FooterLink href="/saved">저장한 뉴스</FooterLink>
          <FooterLink href="/archive">아카이브</FooterLink>
          <FooterLink href="/settings">설정</FooterLink>
        </footer>
      </main>
    </>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-slate-100 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      {children}
    </Link>
  );
}
