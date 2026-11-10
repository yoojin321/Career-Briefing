import type { AnalysisContent } from "@/lib/types";
import { confidenceLabel } from "@/lib/format";

function Section({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7 border-t border-slate-100 pt-6 first:border-t-0 first:pt-0 dark:border-slate-800">
      <h2 className="mb-3 flex items-center gap-2.5 text-[17px] font-bold tracking-tight">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-soft text-xs font-bold text-brand dark:bg-brand/15">
          {index}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function AnalysisView({ content }: { content: AnalysisContent }) {
  const conf = confidenceLabel(content.confidence);
  return (
    <div>
      {/* 분석 메타 헤더 */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand dark:bg-brand/15">
          ✦ AI 분석
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${conf.className}`}
        >
          {conf.text}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          전망·예상은 사실과 구분해 표시됩니다
        </span>
      </div>

      <Section index={1} title="핵심 요약">
        <ul className="space-y-2">
          {content.summary.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section index={2} title="배경과 원인">
        <div className="ai-block">
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
            {content.background}
          </p>
        </div>
      </Section>

      <Section index={3} title="핵심 개념">
        <dl className="grid gap-3 sm:grid-cols-2">
          {content.keyConcepts.map((c, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <dt className="font-semibold text-brand">{c.term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {c.explanation}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section index={4} title="영향과 쟁점">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              기회
            </h3>
            <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {content.industryImpact.opportunities.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-900/10">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-rose-600 dark:text-rose-400">
              위험·쟁점
            </h3>
            <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {content.industryImpact.threats.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose-500" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-semibold">전망 (분석/예상): </span>
          {content.industryImpact.outlook}
        </p>
      </Section>

      {/* 취업·면접 활용 — 접기/펼치기 */}
      <details className="group mt-7 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-slate-50/60 px-5 py-4 font-bold transition hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/70">
          <span className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">
              5
            </span>
            취업·면접 활용
          </span>
          <span className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${relevanceBadge(content.careerRelevance).className}`}
            >
              {relevanceBadge(content.careerRelevance).text}
            </span>
            <svg
              className="h-4 w-4 text-slate-400 transition group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </summary>

        <div className="border-t border-slate-100 p-5 dark:border-slate-800">
          {content.careerRelevance === "low" && (
            <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              이 기사는 취업·면접 준비와의 직접적 관련성이 낮습니다. 아래 내용은
              참고용이며 억지 연결은 피했습니다.
            </p>
          )}
          <h3 className="eyebrow mb-3">활용 포인트</h3>
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <CareerCard label="기업 분석" text={content.careerPoints.companyAnalysis} />
            <CareerCard label="직무 관점" text={content.careerPoints.jobPerspective} />
            <CareerCard label="자기소개서" text={content.careerPoints.coverLetter} />
            <CareerCard label="면접 논점" text={content.careerPoints.interviewAngle} />
          </div>
          <h3 className="eyebrow mb-3">예상 면접 질문 및 답변</h3>
          <QuestionBlock label="기본 질문" q={content.interviewQuestions.basic} />
          <QuestionBlock label="심화 질문" q={content.interviewQuestions.advanced} />
        </div>
      </details>

      {content.disclaimers.length > 0 && (
        <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/40">
          <p className="mb-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">
            유의사항
          </p>
          <ul className="space-y-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {content.disclaimers.map((d, i) => (
              <li key={i} className="flex gap-1.5">
                <span>·</span>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function relevanceBadge(r: "high" | "medium" | "low"): {
  text: string;
  className: string;
} {
  switch (r) {
    case "high":
      return {
        text: "취업 관련성 높음",
        className:
          "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-900/30 dark:text-emerald-300",
      };
    case "low":
      return {
        text: "취업 관련성 낮음",
        className:
          "bg-slate-100 text-slate-500 ring-1 ring-slate-400/20 dark:bg-slate-700 dark:text-slate-300",
      };
    default:
      return {
        text: "취업 관련성 보통",
        className:
          "bg-amber-50 text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-900/30 dark:text-amber-300",
      };
  }
}

function CareerCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {text}
      </p>
    </div>
  );
}

function QuestionBlock({
  label,
  q,
}: {
  label: string;
  q: {
    question: string;
    answerPoints: string[];
    sampleAnswer: string;
  };
}) {
  return (
    <div className="mb-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800">
      <div className="mb-2 inline-flex rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand dark:bg-brand/15">
        {label}
      </div>
      <p className="mb-3 font-semibold leading-snug">{q.question}</p>
      <div className="mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          핵심 답변 포인트
        </span>
        <ul className="mt-1.5 space-y-1 text-sm text-slate-700 dark:text-slate-300">
          {q.answerPoints.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-semibold text-brand">{i + 1}.</span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          예시 답변 (약 30초)
        </span>
        <p className="mt-1">{q.sampleAnswer}</p>
      </div>
    </div>
  );
}
