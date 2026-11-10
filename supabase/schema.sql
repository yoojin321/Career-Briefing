-- Career Briefing — Supabase/PostgreSQL 스키마
-- Supabase SQL Editor 또는 psql 로 실행하세요.

create extension if not exists "pgcrypto";

-- 원본 기사 메타데이터
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  source_name text,
  category text not null,
  published_at timestamptz,
  collected_at timestamptz not null default now(),
  description text,
  has_body boolean not null default false,
  dedupe_key text not null,
  raw jsonb,
  constraint articles_url_unique unique (url),
  constraint articles_dedupe_unique unique (dedupe_key)
);
create index if not exists idx_articles_published on articles (published_at desc);
create index if not exists idx_articles_category on articles (category);

-- 날짜별 브리핑 (variant = 다른 뉴스 보기 재생성 번호)
create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  briefing_date date not null,
  variant int not null default 0,
  strategy text not null default 'balanced',
  weights jsonb not null,
  created_at timestamptz not null default now(),
  constraint briefings_date_variant_unique unique (briefing_date, variant)
);
create index if not exists idx_briefings_date on briefings (briefing_date desc);

-- 브리핑 선정 항목
create table if not exists briefing_items (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references briefings(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  rank int not null,
  score numeric not null,
  score_breakdown jsonb not null,
  reason text
);
create index if not exists idx_briefing_items_briefing on briefing_items (briefing_id);

-- AI 분석 결과 (기사와 분리 저장 -> 재생성 가능)
create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references articles(id) on delete cascade,
  depth text not null default 'simple',
  status text not null,
  model text,
  content jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_analyses_article on analyses (article_id, created_at desc);

-- 북마크/학습완료 (선택적 서버 저장; MVP는 localStorage 우선)
create table if not exists user_states (
  article_id uuid primary key references articles(id) on delete cascade,
  bookmarked boolean not null default false,
  learned boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 수집/분석 작업 로그
create table if not exists ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  status text not null,
  stats jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_jobs_started on ingestion_jobs (started_at desc);

-- 외부 API 일일 호출량 (무료 사용량 보호; 서버 재시작과 무관하게 유지)
-- 예: provider='naver', day='2026-11-10' 의 누적 호출 수
create table if not exists api_usage (
  provider text not null,
  day date not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (provider, day)
);

-- 호출 수를 원자적으로 증가시키고(해당 일자 행 upsert) 갱신 후 값을 반환.
-- 동시 호출에도 안전하도록 단일 SQL로 처리한다.
create or replace function increment_api_usage(p_provider text, p_day date, p_delta int)
returns int
language plpgsql
as $$
declare
  new_count int;
begin
  insert into api_usage (provider, day, count, updated_at)
  values (p_provider, p_day, p_delta, now())
  on conflict (provider, day)
  do update set count = api_usage.count + p_delta, updated_at = now()
  returning count into new_count;
  return new_count;
end;
$$;

-- 분산 잠금: 수집/분석 중복 실행 방지.
-- key 예: 'ingest:IT_AI', 'analyze:<articleId>'
create table if not exists service_locks (
  key text primary key,
  locked_until timestamptz not null,
  created_at timestamptz not null default now()
);

-- 잠금 획득 시도. 미보유이거나 만료됐으면 p_ttl초 동안 잠그고 true,
-- 유효한 잠금이 이미 있으면 false 반환. (동시성 안전)
-- 동작: 만료된 잠금을 먼저 삭제한 뒤 INSERT 를 시도한다. INSERT 성공 =
-- 내가 잠금을 획득. 이미 유효한 잠금이 있으면 unique 충돌로 아무 행도 삽입되지
-- 않아 false. ON CONFLICT DO NOTHING + RETURNING 으로 원자적으로 판정한다.
create or replace function acquire_lock(p_key text, p_ttl int)
returns boolean
language plpgsql
as $$
declare
  inserted int;
begin
  delete from service_locks where key = p_key and locked_until < now();
  insert into service_locks (key, locked_until)
  values (p_key, now() + make_interval(secs => p_ttl))
  on conflict (key) do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

-- 수집 신선도 추적: 카테고리별 마지막 수집 시각
create table if not exists ingest_markers (
  category text primary key,
  last_ingested_at timestamptz not null default now()
);
