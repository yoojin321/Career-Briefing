import { randomUUID } from "node:crypto";
import { getRepository } from "@/lib/repo";
import { selectBriefing } from "@/lib/selection/select";
import {
  type Briefing,
  type Category,
  DEFAULT_WEIGHTS,
  type SelectionStrategy,
} from "@/lib/types";

export interface SelectOptionsInput {
  date: string; // YYYY-MM-DD
  count?: number;
  strategy?: SelectionStrategy;
  categories?: Category[];
  sinceHours?: number;
  /** 새 variant로 재생성(다른 뉴스 보기) */
  regenerate?: boolean;
}

/**
 * 날짜별 브리핑 생성/조회.
 * - 이미 저장된 (date, variant=0)이 있으면 그대로 반환 (결과 고정).
 * - regenerate면 다음 variant로, 기존 선정 기사를 제외해 재선정.
 */
export async function getOrCreateBriefing(
  input: SelectOptionsInput,
): Promise<Briefing> {
  const repo = getRepository();
  const count = clampCount(input.count ?? 3);
  const strategy = input.strategy ?? "balanced";
  const sinceHours = input.sinceHours ?? 48;

  if (!input.regenerate) {
    const existing = await repo.getBriefing(input.date, 0);
    if (existing) return existing;
  }

  // 다음 variant 결정 + 기존 선정 기사 제외 목록
  let variant = 0;
  const excludeIds: string[] = [];
  if (input.regenerate) {
    for (let v = 0; ; v++) {
      const b = await repo.getBriefing(input.date, v);
      if (!b) {
        variant = v;
        break;
      }
      excludeIds.push(...b.items.map((i) => i.articleId));
    }
  }

  const candidates = await repo.listCandidates({
    sinceHours,
    categories: input.categories,
    limit: 200,
  });

  const items = selectBriefing(candidates, {
    count,
    strategy,
    weights: DEFAULT_WEIGHTS,
    excludeIds,
    seed: variant,
  });

  const briefing: Briefing = {
    id: randomUUID(),
    briefingDate: input.date,
    variant,
    strategy,
    weights: DEFAULT_WEIGHTS,
    createdAt: new Date().toISOString(),
    items,
  };

  return repo.saveBriefing(briefing);
}

/** 오늘 날짜(KST) YYYY-MM-DD */
export function todayKst(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 36e5);
  return kst.toISOString().slice(0, 10);
}

function clampCount(n: number): number {
  return Math.max(1, Math.min(10, Math.floor(n)));
}
