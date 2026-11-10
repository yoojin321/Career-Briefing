import { getSupabaseConfig } from "@/lib/env";
import { getMemoryRepository } from "./memory";
import { SupabaseRepository } from "./supabase";
import type { Repository } from "./types";

export type { Repository, ArticleUpsert } from "./types";

let supabaseRepo: SupabaseRepository | null = null;

/**
 * 저장소 선택:
 * - Supabase 설정 있음 -> SupabaseRepository (영속)
 * - 없음 -> MemoryRepository (개발용, 프로세스 메모리). 실제 수집 데이터만 담는다.
 */
export function getRepository(): Repository {
  const cfg = getSupabaseConfig();
  if (cfg) {
    if (!supabaseRepo) supabaseRepo = new SupabaseRepository(cfg);
    return supabaseRepo;
  }
  return getMemoryRepository();
}

/** 저장소 종류 (상태 표시용) */
export function getRepositoryKind(): "supabase" | "memory" {
  return getSupabaseConfig() ? "supabase" : "memory";
}
