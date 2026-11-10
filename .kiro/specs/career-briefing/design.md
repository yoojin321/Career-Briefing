# Design — Career Briefing

## 1. 기술 스택 결정
- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **DB**: Supabase PostgreSQL (프로덕션). 로컬/키 미설정 시에는 동작하지 않음을 명시하고, 개발용은 샘플 플래그로만 노출.
- **AI**: 환경변수로 교체 가능한 LLM API (OpenAI 호환 Chat Completions). `LLM_API_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.
- **뉴스 소스**: 네이버 뉴스 검색 API (adapter 1), 공식 RSS (adapter 2).
- **Validation**: Zod (AI 출력, 설정, 환경변수).
- **Scheduling**: Vercel Cron (`vercel.json`) + 수동 트리거 API.
- **Test**: Vitest (순수 로직 단위 테스트, 외부 I/O 없음).

클라이언트는 DB/외부 API를 직접 호출하지 않는다. 모든 수집·분석·DB 쓰기는 서버(Route Handlers/Server Components)에서 수행.

## 2. 데이터 흐름
```
[Cron / 수동 트리거]
   -> Ingestion Service
        -> Source Adapters (Naver API, RSS)  [원본 기사 수집]
        -> 정규화 + 카테고리 분류 + 중복 제거
        -> articles 테이블 upsert (dedupe_key)
        -> ingestion_jobs 로그
   -> Selection Service
        -> 후보 articles 로드 -> 점수 계산(가중치) -> 다양성 고려 선정
        -> briefings + briefing_items 저장 (날짜별 고정)
   -> Analysis Service (선정 기사 각각)
        -> LLM 호출 -> Zod 검증 -> 재시도 -> analyses 저장 (status)

[사용자]
   대시보드 (오늘 briefing) -> 상세(analysis) -> 북마크/학습완료(localStorage+DB 옵션)
   아카이브(날짜별 briefing) / 설정(localStorage)
```

## 3. 페이지 구성 (App Router)
- `/` — 메인 대시보드 (오늘 브리핑). Server Component가 오늘 briefing 조회.
- `/news/[id]` — 뉴스 상세 (기사 + 분석).
- `/archive` — 날짜별 아카이브, 필터/검색.
- `/saved` — 북마크/학습완료 뉴스.
- `/settings` — 사용자 설정 (클라이언트, localStorage).
- `/admin` — 관리자 수동 수집/분석 트리거 (시크릿 입력).

### API Route Handlers
- `POST /api/ingest` — 수집 실행 (관리자 시크릿 필요). query: categories, hours.
- `POST /api/select` — 날짜별 브리핑 생성/고정 (관리자 시크릿). body: date, count, strategy.
- `POST /api/analyze` — 특정 브리핑/기사 분석 (관리자 시크릿).
- `POST /api/cron` — Cron 진입점: ingest -> select -> analyze 순차 실행 (CRON_SECRET).
- `GET /api/briefings?date=YYYY-MM-DD` — 브리핑 조회 (공개 읽기).
- `GET /api/articles/[id]` — 기사+분석 조회.
- `POST /api/briefings/regenerate` — "다른 뉴스 보기" (제외 목록 기반 재선정, 새 variant 저장).

## 4. DB 스키마 (PostgreSQL / Supabase)

### articles
| col | type | note |
|---|---|---|
| id | uuid pk | |
| title | text not null | |
| url | text not null unique | 원문 URL |
| source_name | text | 언론사/기관명 |
| category | text not null | 5개 enum 중 하나 |
| published_at | timestamptz | 발행일 |
| collected_at | timestamptz default now() | 수집일 |
| description | text | 공식 제공 요약(메타) |
| has_body | boolean default false | 본문 확보 여부 |
| dedupe_key | text not null unique | normalize(title)+domain |
| raw | jsonb | 원본 메타 |

인덱스: `(published_at desc)`, `(category)`, unique `(url)`, unique `(dedupe_key)`.

### briefings
| col | type | note |
|---|---|---|
| id | uuid pk | |
| briefing_date | date not null | |
| variant | int default 0 | "다른 뉴스 보기" 재생성 번호 |
| strategy | text | balanced/interest/random |
| weights | jsonb | 사용된 가중치 |
| created_at | timestamptz | |

unique `(briefing_date, variant)`.

### briefing_items
| col | type | note |
|---|---|---|
| id | uuid pk | |
| briefing_id | uuid fk -> briefings | |
| article_id | uuid fk -> articles | |
| rank | int | 선정 순위 |
| score | numeric | 종합 점수 |
| score_breakdown | jsonb | {recency, importance, careerRelevance, diversity} |
| reason | text | 선정 사유 |

인덱스: `(briefing_id)`.

### analyses
| col | type | note |
|---|---|---|
| id | uuid pk | |
| article_id | uuid fk -> articles | |
| depth | text | simple/detailed |
| status | text | pending/completed/failed/unconfigured |
| model | text | 사용 모델 |
| content | jsonb | AnalysisContent (Zod 검증 통과본) |
| error | text | 실패 사유 |
| created_at | timestamptz | |

인덱스: `(article_id)`.

### user_states (북마크/학습완료 — 선택적 서버 저장, MVP는 localStorage 우선)
| col | type | note |
|---|---|---|
| article_id | uuid | |
| bookmarked | boolean | |
| learned | boolean | |
| updated_at | timestamptz | |

### ingestion_jobs
| col | type | note |
|---|---|---|
| id | uuid pk | |
| kind | text | ingest/select/analyze/cron |
| status | text | success/partial/failed |
| stats | jsonb | {fetched, inserted, deduped, errors} |
| error | text | |
| started_at / finished_at | timestamptz | |

## 5. 선정 알고리즘 상세
각 후보 기사에 대해 0~1 정규화 점수:
- **recency**: `clamp(1 - ageHours/168, 0, 1)` (7일=168h 기준 선형 감쇠).
- **importance**: 소스/언론사 가중 + 키워드 중요도 사전(정책·실적·규제 등 시그널) 기반 규칙 점수. (AI 가용 시 보정 가능, Phase 3)
- **careerRelevance**: 취업 관련 키워드 사전(채용/산업전략/직무/자격/기업분석 등) 매칭 비율.
- **diversity**: 선정 과정에서 이미 뽑힌 카테고리면 패널티. 라운드 진행 중 동적 조정.

종합: `0.25*recency + 0.30*importance + 0.30*careerRelevance + 0.15*diversity`.
Greedy 선정: 매 라운드 현재 diversity 반영 재계산 → 최고점 선택 → N개까지. 동점은 published_at desc, 그다음 id로 결정 (determinism).
결과는 `briefings`에 고정 저장. 동일 (date, variant)이면 저장본 반환.

## 6. AI 분석 계약 (Zod)
`AnalysisContent`:
```
summary: string[]            // 최대 3
background: string
keyConcepts: {term, explanation}[]  // 2~3
industryImpact: { opportunities: string[], threats: string[], outlook: string }
careerPoints: { companyAnalysis, coverLetter, jobPerspective, interviewAngle: string }
interviewQuestions: {
  basic:   { question, answerPoints: string[](3), sampleAnswer }
  advanced:{ question, answerPoints: string[](3), sampleAnswer }
}
confidence: "high"|"medium"|"needs_verification"
disclaimers: string[]        // 전망/예상 구분, 확인필요 표시
```
LLM 호출은 JSON 출력 강제. 파싱→Zod→실패 시 재시도(최대 2). 제목만 있는 기사(has_body=false)는 프롬프트에 "제한된 정보" 명시 + confidence=needs_verification 강제.

## 7. 소스 어댑터 인터페이스
```ts
interface NewsSourceAdapter {
  id: string;
  fetch(opts: { query: string; category: Category; sinceHours: number }):
    Promise<RawArticle[]>;
}
```
- `NaverNewsAdapter`: 네이버 검색 API(`/v1/search/news.json`). 카테고리별 질의어 세트. 제목/링크/pubDate/description 사용(본문 저장 안 함).
- `RssAdapter`: 공식 RSS(기관 보도자료 등). item title/link/pubDate/source.

실패 시 adapter 단위 에러 → job stats.errors에 집계, 다른 어댑터는 계속 진행.

## 8. 환경변수 (.env.example)
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
# Naver News API
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
# LLM (OpenAI 호환)
LLM_API_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
# 운영
ADMIN_SECRET=
CRON_SECRET=
```
키 미설정 시: 수집/분석은 "미설정" 상태를 명시적으로 반환하고 가짜 데이터 금지.

## 9. 에러/빈 상태 UX
- 로딩: 스켈레톤 카드.
- 빈 데이터: "오늘 선정된 뉴스가 없습니다" + 수집 안내.
- 수집 실패: 마지막 성공 브리핑 + 에러 배너.
- 분석 실패/미설정: 카드/상세에 상태 배지 + 설정 안내 링크.

## 10. 디자인 시스템
- 미니멀, 밝은 배경, 넉넉한 여백, 명확한 타이포. 다크모드 토글.
- 사실/AI해석 구분: AI 해석 블록은 좌측 보더 + "AI 분석" 배지.
- 반응형: 모바일 1열, 태블릿 2열, PC 3열 카드 그리드.
