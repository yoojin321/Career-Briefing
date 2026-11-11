/**
 * 분석 시점에만 원문 본문을 "일시적으로" 가져오는 모듈 (대안 B).
 *
 * 원칙:
 * - 분석(LLM 입력)에만 사용하고 본문을 DB에 저장하지 않는다.
 * - robots.txt를 확인해 허용된 경우에만 가져온다(차단 시 가져오지 않음).
 * - 실패/차단/페이월/동적 렌더링 등은 조용히 폴백(본문 없이 기존 메타로 분석).
 * - 과도한 수집 방지: 타임아웃, 본문 길이 상한.
 *
 * 환경변수:
 * - ARTICLE_BODY_FETCH=0 으로 전체 비활성화 가능(기본 활성).
 * - ARTICLE_BODY_MAX_CHARS 로 LLM에 넣을 본문 최대 길이(기본 6000).
 */

const USER_AGENT = "CareerBriefingBot/0.1 (+personal study; respects robots)";
const FETCH_TIMEOUT_MS = 8000;

export function bodyFetchEnabled(): boolean {
  return process.env.ARTICLE_BODY_FETCH !== "0";
}

export function bodyMaxChars(): number {
  const n = Number.parseInt(process.env.ARTICLE_BODY_MAX_CHARS ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return 6000;
  return Math.min(n, 20000);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
      cache: "no-store",
      redirect: "follow",
    });
  } finally {
    clearTimeout(t);
  }
}

/**
 * robots.txt 를 조회해 주어진 경로가 우리 User-Agent에 허용되는지 판단.
 * 보수적으로: robots를 못 읽으면(네트워크 오류 등) 허용하지 않는다(false 반환)면
 * 과하게 막히므로, "명시적 Disallow에 걸리면 false, 그 외 허용"으로 처리한다.
 * robots가 아예 없으면(404) 허용으로 본다(일반 관행).
 */
export async function isAllowedByRobots(url: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;

  const robotsUrl = `${u.origin}/robots.txt`;
  let text: string;
  try {
    const res = await fetchWithTimeout(robotsUrl);
    if (res.status === 404) return true; // robots 없음 -> 관행상 허용
    if (!res.ok) return false; // 접근 불가 -> 보수적으로 차단
    text = await res.text();
  } catch {
    return false; // 조회 실패 -> 보수적으로 차단
  }

  return isPathAllowed(text, u.pathname + u.search);
}

/**
 * robots.txt 텍스트를 파싱해 경로 허용 여부 판단 (순수 함수, 테스트 대상).
 * 우리 봇 이름과 "*" 그룹의 Disallow/Allow 규칙을 본다.
 * 가장 긴 매칭 규칙이 우선(표준 관행). Allow가 더 길면 허용.
 */
export function isPathAllowed(
  robotsTxt: string,
  path: string,
  userAgents: string[] = ["careerbriefingbot", "*"],
): boolean {
  const lines = robotsTxt.split(/\r?\n/);
  // user-agent 그룹별 규칙 수집
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] =
    [];
  let current: (typeof groups)[number] | null = null;
  let expectingAgent = false;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !expectingAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      expectingAgent = true;
    } else if (field === "allow" || field === "disallow") {
      if (!current) {
        current = { agents: ["*"], rules: [] };
        groups.push(current);
      }
      expectingAgent = false;
      if (value) current.rules.push({ allow: field === "allow", path: value });
      else if (field === "disallow")
        current.rules.push({ allow: true, path: "/" }); // 빈 Disallow = 전체 허용
    }
  }

  // 우리에게 적용되는 그룹 선택 (봇 이름 우선, 없으면 *)
  const wanted = userAgents.map((a) => a.toLowerCase());
  let applicable: { allow: boolean; path: string }[] | null = null;
  for (const ua of wanted) {
    const g = groups.find((grp) => grp.agents.includes(ua));
    if (g) {
      applicable = g.rules;
      break;
    }
  }
  if (!applicable) return true; // 해당 규칙 없음 -> 허용

  // 가장 긴 매칭 규칙 우선
  let best: { allow: boolean; len: number } | null = null;
  for (const r of applicable) {
    if (pathMatches(path, r.path)) {
      if (!best || r.path.length > best.len)
        best = { allow: r.allow, len: r.path.length };
    }
  }
  return best ? best.allow : true;
}

function pathMatches(path: string, rule: string): boolean {
  // robots 와일드카드(*)와 끝 고정($) 간단 지원
  if (rule === "") return false;
  const hasEnd = rule.endsWith("$");
  const core = hasEnd ? rule.slice(0, -1) : rule;
  const parts = core.split("*");
  let pos = 0;
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    if (seg === "") continue;
    const found = path.indexOf(seg, pos);
    if (i === 0) {
      if (!path.startsWith(seg)) return false;
      pos = seg.length;
    } else {
      if (found < 0) return false;
      pos = found + seg.length;
    }
  }
  if (hasEnd) {
    const last = parts[parts.length - 1];
    return path.endsWith(last) && (parts.length > 1 || path === core);
  }
  return true;
}

/**
 * HTML에서 본문 텍스트를 추출 (순수 함수, 테스트 대상).
 * 완벽하지 않음을 전제로, <article> 우선 → 없으면 <p> 태그 텍스트를 모아
 * 가장 텍스트가 많은 블록을 사용. 스크립트/스타일/태그 제거.
 */
export function extractArticleText(html: string): string {
  // 스크립트/스타일/노스크립트 제거
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // <article> 블록이 있으면 우선 사용
  const articleMatch = h.match(/<article[\s\S]*?<\/article>/i);
  if (articleMatch) h = articleMatch[0];

  // <p> 텍스트 수집
  const paras = [...h.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .map((t) => t.trim())
    .filter((t) => t.length >= 20); // 너무 짧은 건 메뉴/캡션일 확률

  let text = paras.join("\n");
  // 유의미한 <p>를 하나도 못 뽑은 경우에만 전체 태그 제거로 폴백
  if (paras.length === 0) {
    text = stripTags(h);
  }
  return normalizeWhitespace(text);
}

function stripTags(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeWhitespace(s: string): string {
  return s
    .split(/\n+/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export interface BodyFetchResult {
  ok: boolean;
  text: string | null;
  reason:
    | "disabled"
    | "robots_blocked"
    | "http_error"
    | "not_html"
    | "too_short"
    | "error"
    | "ok";
}

/**
 * 본문을 일시적으로 가져온다. 성공 시 text(최대 길이 제한) 반환.
 * 어떤 경우에도 예외를 던지지 않고 reason으로 폴백 사유를 알린다.
 * 반환된 text는 호출자가 LLM 입력으로만 사용하고 저장하지 않아야 한다.
 */
export async function fetchArticleBody(url: string): Promise<BodyFetchResult> {
  if (!bodyFetchEnabled()) return { ok: false, text: null, reason: "disabled" };

  try {
    const allowed = await isAllowedByRobots(url);
    if (!allowed) return { ok: false, text: null, reason: "robots_blocked" };

    const res = await fetchWithTimeout(url);
    if (!res.ok) return { ok: false, text: null, reason: "http_error" };

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return { ok: false, text: null, reason: "not_html" };

    const html = await res.text();
    const text = extractArticleText(html);
    if (text.length < 200)
      return { ok: false, text: null, reason: "too_short" };

    return { ok: true, text: text.slice(0, bodyMaxChars()), reason: "ok" };
  } catch {
    return { ok: false, text: null, reason: "error" };
  }
}
