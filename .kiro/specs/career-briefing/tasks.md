# Tasks — Career Briefing

## Phase 1 — MVP (실제 동작 목표)

- [x] 1. 프로젝트 스캐폴드 (Next.js App Router + TS + Tailwind) 및 기본 설정
- [x] 2. 핵심 타입 & Zod 스키마 정의
- [x] 3. 선정 알고리즘 (순수 함수) + 단위 테스트 (15 tests pass)
- [x] 4. 소스 어댑터 (Naver API, RSS=연합뉴스 공식 피드) + 파서 단위 테스트 (6 tests pass)
- [x] 5. 저장소 계층 (Supabase repo + 인메모리 fallback repo)
- [x] 6. AI 분석 서비스 + Zod 검증/재시도 + 단위 테스트 (6 tests pass)
- [x] 7. API Route Handlers (ingest/select/analyze/cron/briefings/articles/regenerate/status/archive)
- [x] 8. 메인 대시보드 UI + 상태 화면
- [x] 9. 뉴스 상세 페이지 UI (섹션별 분석, 사실/AI 구분, 원문 링크)
- [x] 10. 관리자 페이지 (수동 수집/선정/분석 트리거)
- [x] 11. .env.example, README, vercel.json cron, supabase/schema.sql
- [x] 12. 타입체크/빌드/테스트 통과 확인 (typecheck OK, build OK, 27 tests pass, 실제 RSS 수집→선정→조회 E2E 확인)

## Phase 2 — 개인화
- [x] 13. 설정 페이지(localStorage): 카테고리/개수/전략/깊이/다크모드
- [x] 14. 북마크·학습완료 (localStorage; 서버 user_states 테이블 준비됨)
- [x] 15. 아카이브: 날짜별 조회/필터/검색/정렬/북마크만
- [x] 16. "다른 뉴스 보기" variant 재생성 연결
- [x] 17. 라이트/다크 모드 토글

## Phase 3 — 고도화 (후속)
- [ ] 18. 자동 예약 수집 고도화, 개인화 추천, 기업/직무 연관성, 복습, 장기 이슈 추적, 계정/동기화
