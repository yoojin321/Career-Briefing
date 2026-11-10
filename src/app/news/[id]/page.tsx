"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AnalysisView } from "@/components/AnalysisView";
import {
  type AnalyzeResponse,
  type AuthState,
  analyzeArticleRequest,
  fetchArticle,
  fetchAuth,
} from "@/lib/api-client";
import { useArticleState } from "@/lib/settings";
import {
  categoryColor,
  categoryLabel,
  formatDate,
  formatDateTime,
} from "@/lib/format";
import type { Analysis, Article } from "@/lib/types";

type AnalyzeState = "idle" | "analyzing" | "done";

export default function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [article, setArticle] = useState<Article | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>("idle");
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    fetchAuth().then(setAuth).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchArticle(id);
        setArticle(data.article);
        setAnalysis(data.analysis);
        if (!data.article) setError("기사를 찾을 수 없습니다");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const runAnalyze = useCallback(async () => {
    setAnalyzeState("analyzing");
    setAnalyzeError(null);
    try {
      const res: AnalyzeResponse = await analyzeArticleRequest(id, "simple");
      if (res.status === "unauthorized") {
        setAnalyzeError(
          "AI 분석은 로그인 후 사용할 수 있습니다. 로그인 페이지로 이동하세요.",
        );
        setAnalyzeState("idle");
        return;
      }
      if (res.status === "locked") {
        setAnalyzeError(
          res.message ?? "다른 요청이 분석 중입니다. 잠시 후 다시 시도하세요.",
        );
        setAnalyzeState("idle");
        return;
      }
      if (res.status === "capped") {
        setAnalyzeError(res.error ?? "오늘 분석 한도에 도달했습니다.");
        setAnalyzeState("idle");
        return;
      }
      if (res.analysis) setAnalysis(res.analysis);
      setAnalyzeState("done");
    } catch (e) {
      setAnalyzeError((e as Error).message);
      setAnalyzeState("idle");
    }
  }, [id]);

  const hasCompleted = analysis?.status === "completed" && analysis.content;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <Link
          href="/"
          className="mb-5 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-brand"
        >
          ← 목록으로
        </Link>

        {loading && <DetailSkeleton />}
        {!loading && error && (
          <div className="card border-rose-200 bg-rose-50/60 p-8 text-center text-rose-700 dark:border-rose-900 dark:bg-rose-950/30">
            {error}
          </div>
        )}
        {!loading && article && (
          <article className="animate-fade-in-up">
            <div className="card p-6 sm:p-7">
              <ArticleHeader article={article} />
              <div className="mt-5">
                <ArticleState articleId={article.id} />
              </div>
            </div>

            <div className="mt-6">
              <AnalysisSection
                analysis={analysis}
                hasBody={article.hasBody}
                analyzeState={analyzeState}
                analyzeError={analyzeError}
                hasCompleted={!!hasCompleted}
                authed={auth?.authenticated ?? false}
                onAnalyze={runAnalyze}
              />
            </div>

            <SourceFooter article={article} />
          </article>
        )}
      </main>
    </>
  );
}

function ArticleHeader({ article }: { article: Article }) {
  return (
    <header>
      <span
        className={`mb-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryColor(
          article.category,
        )}`}
      >
        {categoryLabel(article.category)}
      </span>
      <h1 className="text-[22px] font-extrabold leading-snug tracking-tight sm:text-2xl">
        {article.title}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-600 dark:text-slate-300">
          {article.sourceName ?? "출처 미상"}
        </span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span>발행 {formatDateTime(article.publishedAt)}</span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span>수집 {formatDateTime(article.collectedAt)}</span>
      </div>
    </header>
  );
}

function ArticleState({ articleId }: { articleId: string }) {
  const { bookmarked, learned, toggleBookmark, toggleLearned } =
    useArticleState(articleId);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={toggleBookmark}
        className={
          bookmarked
            ? "btn bg-brand text-white hover:bg-brand-fg"
            : "btn-ghost"
        }
      >
        {bookmarked ? "★ 북마크됨" : "☆ 북마크"}
      </button>
      <button
        onClick={toggleLearned}
        className={
          learned
            ? "btn bg-emerald-500 text-white hover:bg-emerald-600"
            : "btn-ghost"
        }
      >
        {learned ? "✓ 학습 완료" : "학습 완료로 표시"}
      </button>
    </div>
  );
}

function AnalysisSection({
  analysis,
  hasBody,
  analyzeState,
  analyzeError,
  hasCompleted,
  authed,
  onAnalyze,
}: {
  analysis: Analysis | null;
  hasBody: boolean;
  analyzeState: AnalyzeState;
  analyzeError: string | null;
  hasCompleted: boolean;
  authed: boolean;
  onAnalyze: () => void;
}) {
  // 미설정 상태
  if (analysis?.status === "unconfigured") {
    return (
      <div className="card p-6">
        <p className="font-semibold text-amber-600 dark:text-amber-400">
          AI 미설정
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          LLM_API_KEY가 설정되지 않아 AI 분석을 생성할 수 없습니다. 임의 분석을
          만들지 않습니다.
        </p>
      </div>
    );
  }

  // 분석 중
  if (analyzeState === "analyzing") {
    return (
      <div className="card flex items-center gap-4 p-6">
        <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-brand/30 border-t-brand" />
        <div>
          <p className="font-semibold">AI가 기사를 분석하고 있습니다</p>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            보통 10~40초 걸립니다. 완료되면 아래에 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  // 완료된 분석 표시
  if (hasCompleted && analysis?.content) {
    return (
      <div className="card p-6 sm:p-7">
        {!hasBody && (
          <p className="mb-5 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <span className="mt-px">ℹ️</span>
            <span>
              제목과 공식 요약을 바탕으로 분석했습니다(원문 전문 미사용). 세부
              사실은 원문에서 확인하세요.
            </span>
          </p>
        )}
        <AnalysisView content={analysis.content} />
      </div>
    );
  }

  // 미인증: 분석 실행 불가 — 로그인 안내 (목록/완료분석 열람은 가능)
  if (!authed) {
    return (
      <div className="card p-10 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-2xl dark:bg-brand/15">
          🔒
        </div>
        <p className="text-base font-semibold">AI 분석은 로그인 후 이용 가능합니다</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          개인용 서비스입니다. 뉴스 탐색은 자유롭게 가능하며, AI 분석 실행은
          로그인한 사용자만 할 수 있습니다.
        </p>
        <Link href="/login" className="btn-primary mt-5 px-6">
          로그인하기
        </Link>
      </div>
    );
  }

  // 실패 상태(이전에 저장된 failed 포함) + 재시도
  const prevFailed = analysis?.status === "failed";

  return (
    <div className="card p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-2xl dark:bg-brand/15">
        {prevFailed ? "⚠️" : "✨"}
      </div>
      <p className="text-base font-semibold">
        {prevFailed ? "이전 분석이 실패했습니다" : "AI 분석 준비 완료"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        {prevFailed
          ? `마지막 시도에서 오류가 발생했습니다. ${analysis?.error ?? ""} 다시 시도할 수 있습니다.`
          : "버튼을 누르면 이 기사에 대해서만 AI 분석(요약·배경·핵심 개념·영향·취업 활용)을 실행합니다."}
      </p>
      {analyzeError && (
        <p className="mx-auto mt-3 max-w-md rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {analyzeError}
        </p>
      )}
      <button onClick={onAnalyze} className="btn-primary mt-5 px-6">
        {prevFailed ? "다시 분석하기" : "AI 분석 실행"}
      </button>
    </div>
  );
}

function SourceFooter({ article }: { article: Article }) {
  return (
    <footer className="mt-6 card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="eyebrow mb-1">출처</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {article.sourceName ?? "출처 미상"} · {formatDate(article.publishedAt)}
        </p>
      </div>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary shrink-0"
      >
        원문 바로가기 ↗
      </a>
    </footer>
  );
}

function DetailSkeleton() {
  return (
    <div className="card animate-pulse space-y-4 p-7">
      <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="h-8 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
      <div className="h-40 rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}
