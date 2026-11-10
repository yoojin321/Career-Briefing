import { type Category, CATEGORY_LABELS } from "@/lib/types";

export function categoryLabel(c: Category): string {
  return CATEGORY_LABELS[c] ?? c;
}

const CATEGORY_COLORS: Record<Category, string> = {
  IT_AI:
    "bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 dark:bg-blue-900/30 dark:text-blue-300",
  ECONOMY:
    "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-900/30 dark:text-emerald-300",
  SOCIETY:
    "bg-amber-50 text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-900/30 dark:text-amber-300",
  INDUSTRY:
    "bg-violet-50 text-violet-600 ring-1 ring-violet-500/20 dark:bg-violet-900/30 dark:text-violet-300",
  POLICY:
    "bg-rose-50 text-rose-600 ring-1 ring-rose-500/20 dark:bg-rose-900/30 dark:text-rose-300",
};

export function categoryColor(c: Category): string {
  return (
    CATEGORY_COLORS[c] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-500/20"
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return "발행일 미상";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "발행일 미상";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function confidenceLabel(
  c: "high" | "medium" | "needs_verification",
): { text: string; className: string } {
  switch (c) {
    case "high":
      return {
        text: "신뢰도 높음",
        className:
          "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-900/30 dark:text-emerald-300",
      };
    case "medium":
      return {
        text: "신뢰도 보통",
        className:
          "bg-amber-50 text-amber-600 ring-1 ring-amber-500/20 dark:bg-amber-900/30 dark:text-amber-300",
      };
    default:
      return {
        text: "확인 필요",
        className:
          "bg-slate-100 text-slate-600 ring-1 ring-slate-400/20 dark:bg-slate-800 dark:text-slate-300",
      };
  }
}
