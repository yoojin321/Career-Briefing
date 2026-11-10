# Career Briefing

취업 준비생을 위한 **분야별 뉴스 탐색 + AI 분석** 웹서비스. 관심 분야의 최신 뉴스를 발행일 최신순으로 탐색하고, 원하는 기사만 골라 AI 분석(요약·배경·핵심 개념·영향과 쟁점·취업/면접 활용)을 실행하는 개인용 학습 플랫폼입니다.

모든 뉴스 수집·AI 호출·DB 접근은 서버에서만 수행하며, API 키는 클라이언트에 노출되지 않습니다. 확보한 출처 정보만으로 분석하고, 원문 전체를 복제·재배포하지 않습니다.

## 주요 특징
- **분야별 탐색 중심**: 5개 카테고리(IT/AI, 경제/금융, 시사/사회, 산업/기업, 정책/공공기관)를 탭으로 선택, 발행일 최신순 + 페이지네이션(더 보기) + 키워드 검색
- **온디맨드 AI 분석**: 목록 조회 시에는 AI를 호출하지 않고, 사용자가 기사를 열어 실행할 때만 분석. 완료된 분석은 재사용(중복 호출 없음)
- **출처별 수집 어댑터 분리**: 네이버 뉴스 검색 API(NCP API HUB) + 연합뉴스 공식 RSS. 수집 후 키워드 기반 카테고리 재분류, 중복 제거(서로 다른 언론사의 동일 사건은 유지)
- **안전한 AI 분석**: 확보한 메타데이터(제목/공식 요약)만 근거로 작성, 전망은 "분석/예상"으로 구분, 근거 부족 시 "확인 필요" 표기, Zod 스키마 검증 + 제한적 재시도(응답 잘림 감지 시 토큰 증량)
- **개인용 로그인**: 비용이 드는 AI 분석은 로그인한 사용자만 실행(목록/검색은 공개). 서버 HttpOnly 세션 쿠키 사용
- **비용/중복 보호**: 분석 일일 상한, 동시 분석 분산 잠금, 네이버 호출량 일일 상한(영속 저장)
- **영속 저장**: Supabase(PostgreSQL). 미설정 시 인메모리 모드로 동작하며 가짜 데이터는 만들지 않음

## 기술 스택
Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase(PostgreSQL) · Zod · Vitest · Vercel 배포 · LLM은 OpenAI 호환 Gateway(BAZE API Gateway / Claude 검증 완료)

## 로컬 실행

```bash
npm install
# Windows PowerShell:
Copy-Item .env.example .env.local   # 값 채우기
npm run dev                         # http://localhost:3000
```

키를 아무것도 설정하지 않아도 앱은 뜹니다. 이 경우:
- 저장소는 **인메모리 모드**(개발용, 서버 재시작 시 초기화)로 동작합니다.
- 네이버 키가 없으면 RSS 어댑터만으로 수집합니다.
- LLM 키가 없으면 AI 분석은 "미설정" 상태로 표시됩니다(가짜 분석 생성 안 함).
- 로그인 미설정 시 분석 API는 503(보호 미구성)으로 비활성화됩니다.

## 환경변수
`.env.example`에 전체 주석과 함께 정리되어 있습니다. 요약:

| 변수 | 용도 | 미설정 시 |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | 영속 저장소 (서버 전용) | 인메모리 모드 |
| `NAVER_API_MODE` | `hub`(NCP API HUB, 기본) 또는 `developers`(구형 오픈API) | `hub` |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 네이버 뉴스 검색 API | 네이버 어댑터 비활성(RSS만) |
| `NAVER_MAX_CALLS_PER_INGEST`, `NAVER_DAILY_CALL_CAP` | 네이버 호출량 보호 | 25 / 500 |
| `LLM_API_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | AI 분석(OpenAI 호환 Gateway) | 분석 "미설정" |
| `LLM_JSON_MODE` | `response_format=json_object` 전송(Claude는 0 권장) | 0 |
| `ANALYSIS_DAILY_CAP` | 하루 AI 분석(실제 호출) 상한 | 50 |
| `APP_PASSWORD` | 개인용 로그인 비밀번호 | 분석 API 비활성(503) |
| `SESSION_SECRET` | 세션 쿠키 서명 키(미설정 시 `ADMIN_SECRET` 폴백) | — |
| `ADMIN_SECRET` | 관리자 수집/선정/분석 트리거 보호 | 관리자 API 401 |
| `CRON_SECRET` | Cron 엔드포인트 보호(현재 Cron 비활성) | Cron 401 |

> 서버 전용 값에는 `NEXT_PUBLIC_` 접두사를 쓰지 마세요. 모든 키는 서버에서만 사용됩니다.

## 뉴스 API 설정 (네이버)
현재 네이버 검색 API는 **NAVER API HUB(네이버 클라우드, NCP)** 방식을 기본으로 합니다.
1. NCP에서 네이버 검색 API를 신청하고 인증 키(ID/Secret)를 발급
2. `.env.local`에 `NAVER_API_MODE=hub`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 입력
3. 구형 개발자센터(`developers.naver.com`) 키를 쓰려면 `NAVER_API_MODE=developers`로 설정
4. **이용약관 확인**: 상업적 이용·콘텐츠 재사용·AI 활용 조건을 반드시 검토하세요. 본 서비스는 제목/링크/발행일/공식 요약 메타만 저장하고 원문 전체를 복제·재배포하지 않습니다.
5. 무료 사용량 보호: 검색 API 무료 한도(하루 25,000회)보다 훨씬 보수적인 자체 상한(ingest당 25, 하루 500)을 코드로 강제합니다.

RSS 소스는 `src/lib/sources/rss.ts`의 `RSS_FEEDS`에서 추가/수정할 수 있습니다. 공식·공개 피드만 사용하세요.

## AI(LLM) 설정
OpenAI 호환 Chat Completions API를 사용합니다. BAZE API Gateway(Claude)로 검증했습니다.
- `LLM_API_BASE_URL`(예: `https://factchat-cloud.mindlogic.ai/v1/gateway`), `LLM_API_KEY`, `LLM_MODEL` 설정
- 호출 경로는 `{BASE_URL}/chat/completions/`(끝 슬래시), 인증은 `Authorization: Bearer <KEY>`
- 모델 사용 가능 여부는 `GET /api/llm-check`(관리자 시크릿 필요)로 사전 확인할 수 있습니다
- Claude 계열은 `response_format(json_object)`를 지원하지 않을 수 있어 `LLM_JSON_MODE=0`(기본) 권장

## 데이터베이스 설정 (Supabase)
1. Supabase 프로젝트 생성(지역은 Seoul 권장)
2. SQL Editor에서 `supabase/schema.sql` **전체** 실행(멱등). 테이블/인덱스/함수가 생성됩니다:
   `articles`, `briefings`, `briefing_items`, `analyses`, `user_states`, `ingestion_jobs`, `api_usage`, `service_locks`, `ingest_markers` + 함수 `increment_api_usage`, `acquire_lock`
   - RLS 경고가 뜨면 **Run and enable RLS**를 선택(앱은 service role 키로 서버에서만 접근하므로 정상 동작)
3. Project URL(`SUPABASE_URL`)과 **secret / service role 키**(`SUPABASE_SERVICE_ROLE_KEY`)를 `.env.local`에 입력

기사(`articles`)와 AI 분석(`analyses`)은 분리 저장되어 분석만 재생성할 수 있습니다.

## 로그인 (개인용)
AI 분석은 로그인한 사용자만 실행할 수 있습니다(목록/검색 조회는 공개).
1. `.env.local`에 `APP_PASSWORD`(원하는 비밀번호)와 `SESSION_SECRET`(긴 랜덤 문자열) 설정
2. `/login`에서 비밀번호 입력 → 성공 시 HttpOnly 세션 쿠키 발급(기본 12시간)
3. 로그아웃은 헤더의 로그아웃 버튼

## 뉴스 수집 / 분석 실행

### 자동 (조회 시 갱신)
메인에서 카테고리를 처음 열면, 마지막 수집이 **3시간**보다 오래됐을 때 서버가 자동으로 최신 뉴스를 수집합니다. 동시 접속 시에도 분산 잠금으로 중복 수집을 막습니다. "새로고침" 버튼으로 수동 갱신도 가능합니다.

### 관리자 수동 (API 직접 호출)
```bash
# 수집 (전체 또는 특정 카테고리)
curl -X POST http://localhost:3000/api/ingest   -H "x-admin-secret: $ADMIN_SECRET" -H "Content-Type: application/json" -d '{"sinceHours":48}'
# 네이버 호출량 확인
curl http://localhost:3000/api/naver-usage      -H "x-admin-secret: $ADMIN_SECRET"
# LLM 모델 접근 확인
curl "http://localhost:3000/api/llm-check"      -H "x-admin-secret: $ADMIN_SECRET"
```

### 사용자 분석 (로그인 필요)
기사 상세(`/news/[id]`)에서 "AI 분석 실행" → `POST /api/news/[id]/analyze`. 완료된 분석은 재사용되고, 동시 요청은 서버 잠금으로 1회만 호출되며, 하루 `ANALYSIS_DAILY_CAP`회로 제한됩니다.

> Cron 예약 실행은 현재 **비활성화**되어 있습니다(필수 아님). 필요하면 `vercel.json`에 `crons`를 추가하고 `/api/cron`과 `CRON_SECRET`을 사용하세요.

## 배포 (Vercel)
1. GitHub에 푸시 후 Vercel에서 Import
2. **환경변수 등록**(Production 스코프): 위 표의 변수를 모두 등록. `.env.local`은 배포에 포함되지 않습니다
3. 배포. AI 분석은 10~40초가 걸릴 수 있으며, `/api/news/[id]/analyze`에 `maxDuration=60`이 설정되어 있습니다(Vercel 함수 최대 실행 시간은 플랜 정책을 따름)
4. Next.js는 보안 패치 버전(15.5.7+)을 사용합니다

## 테스트 / 품질
```bash
npm run test       # 단위 테스트 (선정 로직, 중복 제거, 파서, AI 스키마 검증, 재시도/잘림/오류 분류, 수집 복원력)
npm run typecheck  # 타입 체크
npm run build      # 프로덕션 빌드
```

## 폴더 구조
```
src/
  app/
    page.tsx                 # 메인 — 분야별 뉴스 탐색(탭/검색/더보기)
    news/[id]/page.tsx       # 뉴스 상세 + 온디맨드 AI 분석
    login/ saved/ archive/ settings/ admin/
    api/
      news/                  # GET 목록(공개), [id]/analyze POST(로그인 필요)
      auth/                  # login / logout / me (세션)
      articles/[id]/ status/ naver-usage/ llm-check/
      ingest/ select/ analyze/ briefings/ archive/ cron/   # 관리자/레거시
  components/                # Header, ArticleCard, AnalysisView, AuthButton, StatusBanner, ThemeScript ...
  lib/
    types.ts                 # 도메인 타입 + Zod 스키마
    env.ts auth.ts session.ts  # 환경변수 / 관리자 인증 / 개인 세션
    selection/               # 점수·중복 제거·선정 (순수 함수 + 테스트)
    sources/                 # 어댑터(naver, rss) · 파서 · 분류 · 호출량 제한 (+ 테스트)
    repo/                    # 저장소(supabase / memory) + 인터페이스
    ai/                      # LLM 클라이언트 · 프롬프트 · 분석 검증/재시도 (+ 테스트)
    services/                # browse / ingest / analysis / briefing 오케스트레이션
supabase/schema.sql          # DB 스키마(테이블/인덱스/함수)
```

## 데이터 흐름
1. **탐색**: 사용자가 카테고리 선택 → `GET /api/news` → (신선도 초과 시) 서버 자동 수집(네이버+RSS → 정규화 → 재분류 → 중복 제거 → Supabase 저장) → 발행일 최신순 목록 반환. **이 단계에서 AI 미호출.**
2. **분석**: 사용자가 기사 열람 → "AI 분석 실행"(로그인 필요) → 기존 완료 분석 있으면 재사용, 없으면 BAZE 호출 → Zod 검증/재시도 → Supabase 저장.

## 구현 범위

### 구현 완료
- 분야별 뉴스 탐색(탭/최신순/더보기/검색), 자동 수집(3h 신선도 + 분산 잠금), 수동 새로고침
- 실제 수집(네이버 API HUB + 연합뉴스 RSS), 카테고리 재분류, 관련성 필터, 중복 제거
- 온디맨드 AI 분석(요약·배경·핵심 개념·영향과 쟁점·취업/면접 활용), 완료 재사용, 동시 분석 잠금, 일일 상한
- AI 응답 안정화(max_tokens·finish_reason 처리, 일시적 오류만 제한적 재시도, 진단 기록)
- 개인용 로그인(HttpOnly 세션), 분석 API 인증 게이트
- Supabase 영속 저장(기사/분석 분리), 북마크·학습 완료(localStorage), 아카이브, 설정, 다크모드
- 관리자 수동 트리거(보안), 상태/미설정 안내, 네이버 호출량·LLM 모델 점검 API
- 단위 테스트 / 타입체크 / 프로덕션 빌드

### 향후 작업
- 개인화 추천, 기업/직무별 연관성 분석, 면접 복습, 장기 이슈 추적
- 사용자 계정 및 클라우드 동기화(현재 설정/북마크는 localStorage, 서버 `user_states` 테이블 준비됨)
- 공개 분석 API의 IP/세션 레이트리밋(현재는 인증 + 일일 상한 + 잠금으로 보호)

## 콘텐츠·라이선스 유의
- 원문 전체 복제/재배포를 하지 않으며, 제목·링크·발행일·공식 제공 요약 메타만 저장합니다.
- AI는 확보한 출처 정보만 근거로 분석하며, 근거 없는 수치·인용·기관 입장을 생성하지 않습니다. 전망은 "분석/예상"으로 구분하고, 본문을 확보하지 못한 경우 그 사실을 표시하며 근거가 부족하면 "확인 필요"로 표기합니다.
