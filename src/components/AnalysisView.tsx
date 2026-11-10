import type { AnalysisContent } from "@/lib/types";
import { confidenceLabel } from "@/lib/format";

function Section({
  title,
  children,
  ai = false,
}: {
  title: string;
  children: React.ReactNode;
  ai?: boolean;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        {title}
        {ai && (
          <span className="rounded bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            AI 분석
          </span>
        )}
      </h2>
      <div className={ai ? "ai-block py-1" : ""}>{children}</div>
    </section>
  );
}

export function AnalysisView({ content }: { content: AnalysisContent }) {
  const conf = confidenceLabel(content.confidence);
  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${conf.className}`}>
          {conf.text}
        </span>
        <span className="text-xs text-slate-500">
          아래 분석은 AI가 생성했으며 전망·예상은 사실과 구분됩니다.
        </span>
      </div>

      <Section title="핵심 요약">
        <ul className="list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
          {content.summary.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>

      <Section title="배경과 원인" ai>
        <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">
          {content.background}
        </p>
      </Section>

      <Section title="핵심 개념" ai>
        <dl className="space-y-3">
          {content.keyConcepts.map((c, i) => (
            <div key={i} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <dt className="font-semibold text-brand">{c.term}</dt>
              <dd className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                {c.explanation}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="영향과 쟁점" ai>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-semibold text-emerald-600">기회</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {content.industryImpact.opportunities.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-rose-600">위험·쟁점</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {content.industryImpact.threats.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-semibold">전망(분석/예상): </span>
          {content.industryImpact.outlook}
        </p>
      </Section>

      {/* 취업·면접 활용 — 접기/펼치기 */}
      <details className="mb-8 rounded-xl border border-slate-200 open:pb-2 dark:border-slate-800">
        <summary className="flex cursor-pointer items-center justify-between gap-2 rounded-xl px-4 py-3 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <span className="flex items-center gap-2">
            취업·면접 활용
            <span className="rounded bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              AI 분석
            </span>
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${relevanceBadge(content.careerRelevance).className}`}>
            {relevanceBadge(content.careerRelevance).text}
          </span>
        </summary>

        <div className="px-4">
          {content.careerRelevance === "low" && (
            <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              이 기사는 취업·면접 준비와의 직접적 관련성이 낮습니다. 아래 내용은
              참고용이며 억지 연결은 피했습니다.
            </p>
          )}
          <div className="ai-block py-1">
            <h3 className="mb-3 text-sm font-semibold">활용 포인트</h3>
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <CareerCard label="기업 분석" text={content.careerPoints.companyAnalysis} />
              <CareerCard label="직무 관점" text={content.careerPoints.jobPerspective} />
              <CareerCard label="자기소개서" text={content.careerPoints.coverLetter} />
              <CareerCard label="면접 논점" text={content.careerPoints.interviewAngle} />
            </div>
            <h3 className="mb-3 text-sm font-semibold">예상 면접 질문 및 답변</h3>
            <QuestionBlock label="기본 질문" q={content.interviewQuestions.basic} />
            <QuestionBlock label="심화 질문" q={content.interviewQuestions.advanced} />
          </div>
        </div>
      </details>

      {content.disclaimers.length > 0 && (
        <Section title="유의사항">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-500 dark:text-slate-400">
            {content.disclaimers.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </Section>
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
      return { text: "취업 관련성 높음", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
    case "low":
      return { text: "취업 관련성 낮음", className: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" };
    default:
      return { text: "취업 관련성 보통", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
  }
}

function CareerCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-1 text-xs font-semibold uppercase text-slate-500">
        {label}
      </div>
      <p className="text-sm text-slate-700 dark:text-slate-300">{text}</p>
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
    <div className="mb-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 text-xs font-semibold text-brand">{label}</div>
      <p className="mb-2 font-medium">{q.question}</p>
      <div className="mb-2">
        <span className="text-xs font-semibold text-slate-500">핵심 답변 포인트</span>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700 dark:text-slate-300">
          {q.answerPoints.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </div>
      <div className="rounded bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        <span className="text-xs font-semibold text-slate-500">예시 답변(약 30초): </span>
        {q.sampleAnswer}
      </div>
    </div>
  );
}
