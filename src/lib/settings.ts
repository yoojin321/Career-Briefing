"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  type Settings,
  SettingsSchema,
} from "@/lib/types";

const KEY = "cb_settings";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = SettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  document.documentElement.classList.toggle("dark", s.darkMode);
}

/** React hook: 설정 상태 + 저장 */
export function useSettings(): [Settings, (next: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    document.documentElement.classList.toggle("dark", loaded.darkMode);
  }, []);

  const update = (next: Partial<Settings>) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      saveSettings(merged);
      return merged;
    });
  };

  return [settings, update];
}

/* ---- 북마크 / 학습완료 (localStorage) ---- */
const BM_KEY = "cb_bookmarks";
const LN_KEY = "cb_learned";

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...set]));
}

export function useArticleState(articleId: string) {
  const [bookmarked, setBookmarked] = useState(false);
  const [learned, setLearned] = useState(false);

  useEffect(() => {
    setBookmarked(readSet(BM_KEY).has(articleId));
    setLearned(readSet(LN_KEY).has(articleId));
  }, [articleId]);

  const toggleBookmark = () => {
    const set = readSet(BM_KEY);
    if (set.has(articleId)) set.delete(articleId);
    else set.add(articleId);
    writeSet(BM_KEY, set);
    setBookmarked(set.has(articleId));
  };

  const toggleLearned = () => {
    const set = readSet(LN_KEY);
    if (set.has(articleId)) set.delete(articleId);
    else set.add(articleId);
    writeSet(LN_KEY, set);
    setLearned(set.has(articleId));
  };

  return { bookmarked, learned, toggleBookmark, toggleLearned };
}

export function getBookmarkedIds(): string[] {
  return [...readSet(BM_KEY)];
}
export function getLearnedIds(): string[] {
  return [...readSet(LN_KEY)];
}
