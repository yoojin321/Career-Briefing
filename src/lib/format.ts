import { type Category, CATEGORY_LABELS } from "@/lib/types";

export function categoryLabel(c: Category): string {
  return CATEGORY_LABELS[c] ?? c;
}

const CATEGORY_COLORS: Record<Category, string> = {
  IT_AI: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  ECONOMY:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  SOCIETY:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  INDUSTRY:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  POLICY: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

export function categoryColor(c: Category): string {
  return CATEGORY_COLORS[c] ?? "bg-slate-100 text-slate-700";
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
        className: "bg-emerald-100 text-emerald-700",
      };
    case "medium":
      return { text: "신뢰도 보통", className: "bg-amber-100 text-amber-700" };
    default:
      return {
        text: "확인 필요",
        className: "bg-rose-100 text-rose-700",
      };
  }
}
