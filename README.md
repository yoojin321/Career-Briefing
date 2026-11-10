# Career Briefing

취업 준비생을 위한 AI 데일리 뉴스 브리핑 웹서비스. **뉴스 수집 → 중요도 평가 → AI 요약·분석 → 취업 활용 → 학습 기록**으로 이어지는 개인용 뉴스 학습 플랫폼입니다.

단순 뉴스 모음이 아니라, 매일 가중치 기반으로 선정한 주요 이슈를 AI가 요약하고 배경·산업 영향·취업 활용 포인트·예상 면접 질문까지 구조화해 제공합니다.

## 주요 특징
- 5개 카테고리(IT/AI, 경제/금융, 시사/사회, 산업/기업, 정책/공공기관) 균형 수집
- 가중치 기반 선정(최신성 25 / 중요도 30 / 취업활용 30 / 다양성 15), 날짜별 결과 고정
- 출처별 수집 어댑터 분리(네이버 뉴스 API, 공식 RSS) — 향후 소스 추가 용이
- AI 분석은 확보한 출처 정보만 사용, 전망은 "분석/예상"으로 구분, Zod로 검증·재시도
- 키가 없으면 가짜 데이터를 만들지 않고 "미설정" 상태를 명확히 표시

## 기술 스택
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase(PostgreSQL) · Zod · Vitest · Vercel(Cron)

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기 (Windows PowerShell: Copy-Item .env.example .env.local)
npm run dev                  # http://localhost:3000
```

키를 아무것도 설정하지 않아도 앱은 뜹니다. 이 경우:
- 저장소는 **인메모리 모드**(개발용, 서버 재시작 시 초기화)로 동작합니다.
- 네이버 키가 없으면 RSS 어댑터만 동작합니다.
- LLM 키가 없으면 AI 분석은 "미설정" 상태로 표시됩니다(가짜 분석 생성 안 함).

## 환경변수
`.env.example` 참고. 요약:

| 변수 | 용도 | 미설정 시 |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | 영속 저장소 (서버 전용) | 인메모리 모드 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 네이버 뉴스 검색 API | 네이버 어댑터 비활성 |
| `LLM_API_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | AI 분석(OpenAI 호환) | 분석 "미설정" |
| `ADMIN_SECRET` | 관리자 수동 트리거 보호 | 관리자 API 401 |
| `CRON_SECRET` | Cron 엔드포인트 보호 | Cron 401 |

모든 외부 호출(뉴스 API, LLM, DB)은 서버에서만 수행하며 API 키는 클라이언트에 노출되지 않습니다.

## 뉴스 API 설정 (네이버)
1. https://developers.naver.com/apps 에서 애플리케이션 등록 → "검색" API 사용 설정
2. 발급받은 Client ID / Secret을 `.env.local`에 입력
3. **이용약관 확인**: 상업적 이용·콘텐츠 재사용 조건을 반드시 검토하세요. 본 서비스는 제목/링크/발행일/공식 요약 메타만 저장하고 원문 전체를 복제·재배포하지 않습니다.

RSS 소스는 `src/lib/sources/rss.ts`의 `RSS_FEEDS`에서 추가/수정할 수 있습니다. 공식·공개 피드만 사용하세요.

## 데이터베이스 설정 (Supabase)
1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. Project URL과 **service role key**를 `.env.local`에 입력

기사(`articles`)와 AI 분석(`analyses`)은 분리 저장되어 분석만 재생성할 수 있습니다.

## 수집/선정/분석 실행

### 수동 (관리자 페이지)
`/admin` 접속 → `ADMIN_SECRET` 입력 → 버튼으로 수집 → 선정 → 분석 또는 전체(Cron) 실행.

### 수동 (API 직접 호출)
```bash
curl -X POST http://localhost:3000/api/ingest   -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" -d '{"sinceHours":48}'
curl -X POST http://localhost:3000/api/select   -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" -d '{"count":3}'
curl -X POST http://localhost:3000/api/analyze  -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" -d '{"depth":"simple"}'
```

### 스케줄러 (Vercel Cron)
`vercel.json`에 매일 07:00 KST(UTC 22:00) 실행이 설정되어 있습니다. Vercel은 `/api/cron`을 `Authorization: Bearer <CRON_SECRET>`로 호출합니다. Vercel 프로젝트 환경변수에 `CRON_SECRET`을 등록하세요.

스케줄러가 없거나 실패해도 위 관리자 수동 실행으로 대체할 수 있습니다.

## 배포 (Vercel)
1. GitHub에 푸시 후 Vercel에서 import
2. 환경변수 등록(위 표 전체)
3. 배포. `vercel.json`의 Cron이 자동 등록됩니다.

## 테스트 / 품질
```bash
npm run test       # 단위 테스트 (선정 알고리즘, 중복 제거, 파서, AI 스키마 검증)
npm run typecheck  # 타입 체크
npm run build      # 프로덕션 빌드
```

## 폴더 구조
```
src/
  app/                 # 페이지 & API Route Handlers
    page.tsx           # 메인 대시보드
    news/[id]/         # 뉴스 상세
    archive/ saved/ settings/ admin/
    api/               # ingest, select, analyze, cron, briefings, articles, status, archive
  components/          # Header, NewsCard, AnalysisView, StatusBanner, ThemeScript
  lib/
    types.ts           # 도메인 타입 + Zod 스키마
    env.ts auth.ts     # 환경변수/인증
    selection/         # 점수 계산·중복 제거·선정 (순수 함수 + 테스트)
    sources/           # 수집 어댑터 (naver, rss) + 파서 (순수 + 테스트)
    repo/              # 저장소 (supabase / memory) + 인터페이스
    ai/                # LLM 클라이언트·프롬프트·분석 검증 (+ 테스트)
    services/          # ingest / briefing / analysis 오케스트레이션
supabase/schema.sql    # DB 스키마
```

## 데이터 흐름
`Cron 또는 /admin` → `ingest`(어댑터 수집·정규화·중복제거·저장) → `select`(가중치 선정·날짜별 고정 저장) → `analyze`(LLM·Zod 검증·재시도·저장) → 대시보드/상세에서 조회.

## 구현 범위

### 구현 완료 (Phase 1 MVP)
- 실제 뉴스 수집(네이버 API / 공식 RSS), 카테고리 분류, 중복 제거
- 가중치 기반 하루 N개 선정(기본 3, 결과 고정), 선정 근거 저장
- AI 요약·배경·핵심개념·산업영향·취업활용·면접질문 생성 + Zod 검증·재시도
- 메인 대시보드 / 뉴스 상세 / 로딩·빈·실패 상태
- 날짜별 저장·조회, 관리자 수동 트리거(보안), 상태/미설정 안내
- 단위 테스트, 타입체크, 빌드

### 구현 완료 (Phase 2)
- 설정(관심 카테고리/뉴스 개수/선정 방식/분석 깊이/다크모드, localStorage)
- 북마크·학습 완료, 아카이브(날짜/카테고리/검색/북마크 필터), "다른 뉴스 보기"

### 향후 작업 (Phase 3)
- 개인화 추천 알고리즘, 기업/직무별 연관성 분석, 면접 복습, 장기 이슈 추적
- 사용자 계정 및 클라우드 동기화(현재 설정/북마크는 localStorage 기반, 서버 `user_states` 테이블은 준비됨)
- 설정값(개수/카테고리/전략)을 선정에 서버 연동(현재 선정은 API 파라미터로 제어)

## 콘텐츠·라이선스 유의
- 원문 전체 복제/재배포를 하지 않으며, 제목·링크·발행일·공식 제공 요약 메타만 저장합니다.
- AI는 확보한 출처 정보만 근거로 분석하며, 근거 없는 수치·인용·기관 입장을 생성하지 않습니다. 전망은 "분석/예상"으로 구분하고 근거가 부족하면 "확인 필요"로 표기합니다.
