"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        {status && <StatusBanner status={status} />}

        {/* Hero */}
        <div className="mb-7">
          <p className="eyebrow mb-2">DAILY BRIEFING</p>
          <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white">
            분야별 최신 뉴스
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            관심 분야를 골라 최신순으로 탐색하고, 기사를 열어 AI 분석(요약·배경·
            취업 활용)을 실행하세요. 목록 조회는 로그인 없이 가능합니다.
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
              className={category === c && !activeQuery ? "chip-active" : "chip-idle"}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        {/* 검색 + 새로고침 */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <form onSubmit={onSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3-3" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="뉴스 검색 (제목·요약)"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand/50 focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <button type="submit" className="btn-ghost">
              검색
            </button>
            {activeQuery && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveQuery("");
                }}
                className="btn-ghost"
              >
                초기화
              </button>
            )}
          </form>
          <button
            onClick={onManualRefresh}
            disabled={refreshing || !!activeQuery}
            className="btn-primary"
            title={activeQuery ? "검색 중에는 비활성화" : "최신 뉴스 수동 수집"}
          >
            {refreshing ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                수집 중
              </>
            ) : (
              "새로고침"
            )}
          </button>
        </div>

        {/* 결과 요약 줄 */}
        <div className="mb-4 flex min-h-[18px] items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>
            {activeQuery
              ? `"${activeQuery}" 검색 결과`
              : `${CATEGORY_LABELS[category]} · 최신순`}
          </span>
          {refreshNote && <span>{refreshNote}</span>}
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ArticleCardSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="card border-rose-200 bg-rose-50/60 p-10 text-center dark:border-rose-900 dark:bg-rose-950/30">
            <p className="font-semibold text-rose-700 dark:text-rose-300">
              뉴스를 불러오지 못했습니다
            </p>
            <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{error}</p>
            <button
              onClick={() => loadPage(category, 1, activeQuery, false)}
              className="btn mt-4 bg-rose-600 text-white hover:bg-rose-700"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="card p-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800">
              📰
            </div>
            <p className="text-base font-semibold">표시할 뉴스가 없습니다</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {activeQuery
                ? "검색 결과가 없습니다. 다른 키워드를 시도해 보세요."
                : "아직 수집된 기사가 없습니다. 위의 새로고침을 눌러 최신 뉴스를 가져오세요."}
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => (
                <div key={it.article.id} className="animate-fade-in-up">
                  <ArticleCard
                    article={it.article}
                    analysisStatus={it.analysisStatus}
                  />
                </div>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              {hasMore ? (
                <button
                  onClick={() =>
                    loadPage(category, page + 1, activeQuery, false)
                  }
                  disabled={loadingMore}
                  className="btn-ghost px-8"
                >
                  {loadingMore ? "불러오는 중..." : "기사 더 보기"}
                </button>
              ) : (
                <p className="text-xs text-slate-400">— 마지막 기사입니다 —</p>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
