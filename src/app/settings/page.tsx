"use client";

import { Header } from "@/components/Header";
import { useSettings } from "@/lib/settings";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/types";

export default function SettingsPage() {
  const [settings, update] = useSettings();

  function toggleCategory(c: Category) {
    const has = settings.categories.includes(c);
    const next = has
      ? settings.categories.filter((x) => x !== c)
      : [...settings.categories, c];
    update({ categories: next.length ? next : settings.categories });
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">설정</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          설정은 이 브라우저(localStorage)에 저장됩니다. 로그인 없이 바로 사용할
          수 있으며, 향후 계정 동기화로 확장 가능합니다.
        </p>

        <Group title="관심 카테고리">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const active = settings.categories.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => toggleCategory(c)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-brand text-white"
                      : "border border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  }`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              );
            })}
          </div>
        </Group>

        <Group title={`하루 뉴스 개수: ${settings.dailyCount}개`}>
          <input
            type="range"
            min={1}
            max={10}
            value={settings.dailyCount}
            onChange={(e) => update({ dailyCount: Number(e.target.value) })}
            className="w-full"
          />
        </Group>

        <Group title="뉴스 선정 방식">
          <Radio
            name="strategy"
            value={settings.strategy}
            options={[
              { value: "balanced", label: "균형 추천" },
              { value: "interest", label: "관심 분야 우선" },
              { value: "random", label: "랜덤 탐색" },
            ]}
            onChange={(v) => update({ strategy: v as typeof settings.strategy })}
          />
        </Group>

        <Group title="뉴스 분석 깊이">
          <Radio
            name="depth"
            value={settings.depth}
            options={[
              { value: "simple", label: "간단" },
              { value: "detailed", label: "상세" },
            ]}
            onChange={(v) => update({ depth: v as typeof settings.depth })}
          />
        </Group>

        <Group title="다크 모드">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.darkMode}
              onChange={(e) => update({ darkMode: e.target.checked })}
              className="h-5 w-5"
            />
            <span className="text-sm">어두운 테마 사용</span>
          </label>
        </Group>
      </main>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Radio({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={`cursor-pointer rounded-lg border px-4 py-2 text-sm ${
            value === o.value
              ? "border-brand bg-brand/10 text-brand"
              : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="hidden"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
