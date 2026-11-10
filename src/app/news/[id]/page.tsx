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
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/"
          className="mb-6 inline-block text-sm text-slate-500 hover:text-brand"
        >
          ← 목록으로
        </Link>

        {loading && <DetailSkeleton />}
        {!loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700 dark:border-rose-900 dark:bg-rose-950/40">
            {error}
          </div>
        )}
        {!loading && article && (
          <article>
            <ArticleHeader article={article} />
            <ArticleState articleId={article.id} />
            <hr className="my-6 border-slate-200 dark:border-slate-800" />

            <AnalysisSection
              analysis={analysis}
              hasBody={article.hasBody}
              analyzeState={analyzeState}
              analyzeError={analyzeError}
              hasCompleted={!!hasCompleted}
              authed={auth?.authenticated ?? false}
              onAnalyze={runAnalyze}
            />

            <SourceFooter article={article} />
          </article>
        )}
      </main>
    </>
  );
}

function ArticleHeader({ article }: { article: Article }) {
  return (
    <header className="mb-4">
      <span
        className={`mb-3 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColor(
          article.category,
        )}`}
      >
        {categoryLabel(article.category)}
      </span>
      <h1 className="text-2xl font-bold leading-snug">{article.title}</h1>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span>출처: {article.sourceName ?? "미상"}</span>
        <span>발행: {formatDateTime(article.publishedAt)}</span>
        <span>수집: {formatDateTime(article.collectedAt)}</span>
      </div>
    </header>
  );
}

function ArticleState({ articleId }: { articleId: string }) {
  const { bookmarked, learned, toggleBookmark, toggleLearned } =
    useArticleState(articleId);
  return (
    <div className="flex gap-2">
      <button
        onClick={toggleBookmark}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          bookmarked
            ? "border-brand bg-brand text-white"
            : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        }`}
      >
        {bookmarked ? "★ 북마크됨" : "☆ 북마크"}
      </button>
      <button
        onClick={toggleLearned}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          learned
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        }`}
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
      <StatusNote
        title="AI 미설정"
        body="LLM_API_KEY가 설정되지 않아 AI 분석을 생성할 수 없습니다. 임의 분석을 생성하지 않습니다."
        tone="amber"
      />
    );
  }

  // 분석 중
  if (analyzeState === "analyzing") {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-brand/30 bg-brand/5 p-5">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <div>
          <p className="font-semibold">AI가 기사를 분석하고 있습니다…</p>
          <p className="text-sm text-slate-500">
            보통 10~40초 걸립니다. 완료되면 아래에 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  // 완료된 분석 표시
  if (hasCompleted && analysis?.content) {
    return (
      <>
        {!hasBody && (
          <StatusNote
            title="제한된 정보 기반 분석"
            body="본문을 확보하지 못해 제목/공식 요약만으로 분석했습니다. 세부 사실은 원문 확인이 필요합니다."
            tone="amber"
          />
        )}
        <AnalysisView content={analysis.content} />
      </>
    );
  }

  // 미인증: 분석 실행 불가 — 로그인 안내 (목록/완료분석 열람은 가능)
  if (!authed) {
    return (
      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-lg font-semibold">AI 분석은 로그인 후 이용 가능합니다</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          개인용 서비스입니다. 뉴스 목록 탐색은 자유롭게 가능하며, AI 분석
          실행은 로그인한 사용자만 할 수 있습니다.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-fg"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  // 실패 상태(이전에 저장된 failed 포함) + 재시도
  const prevFailed = analysis?.status === "failed";

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900">
      <p className="text-lg font-semibold">
        {prevFailed ? "이전 분석이 실패했습니다" : "아직 분석하지 않은 기사입니다"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        {prevFailed
          ? `마지막 시도에서 오류가 발생했습니다. ${analysis?.error ?? ""} 다시 시도할 수 있습니다.`
          : "아래 버튼을 누르면 이 기사에 대해서만 AI 분석을 실행합니다. 목록 조회 단계에서는 AI를 호출하지 않습니다."}
      </p>
      {analyzeError && (
        <p className="mx-auto mt-3 max-w-md rounded-lg bg-amber-50 p-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {analyzeError}
        </p>
      )}
      <button
        onClick={onAnalyze}
        className="mt-4 rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-fg"
      >
        {prevFailed ? "다시 분석하기" : "AI 분석 실행"}
      </button>
    </div>
  );
}

function StatusNote({
  title,
  body,
  tone = "slate",
}: {
  title: string;
  body: string;
  tone?: "slate" | "amber" | "rose";
}) {
  const colors = {
    slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
    amber: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];
  return (
    <div className={`mb-6 rounded-lg border p-4 ${colors}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{body}</p>
    </div>
  );
}

function SourceFooter({ article }: { article: Article }) {
  return (
    <footer className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
      <h2 className="mb-2 text-sm font-semibold text-slate-500">출처</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {article.title} · {article.sourceName ?? "미상"} ·{" "}
        {formatDate(article.publishedAt)}
      </p>
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-fg"
      >
        원문 바로가기 ↗
      </a>
    </footer>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="h-8 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-40 rounded bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}
