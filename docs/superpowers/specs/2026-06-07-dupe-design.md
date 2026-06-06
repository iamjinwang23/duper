# DUPE — 명품 × 가성비 듀프 매칭 서비스 설계

- **Date**: 2026-06-07
- **Status**: Design approved, pending implementation plan
- **MVP Scope**: B (Standard) · 4~6주 출시 목표

---

## 1. 비전 & 포지셔닝

### 한 줄 정의
> "**핀터레스트의 발견 + 쇼핑몰의 구매 + 가격 콘트라스트의 임팩트**" — 무드로 둘러보다 발견한 명품의 듀프를 지금 살 수 있게 매칭해주는 매거진형 커머스.

### 영감
[taste-like.vercel.app](https://taste-like.vercel.app/) 에서 출발. taste-like 가 "URL/카테고리 → 매칭" 검색 도구라면, DUPE 는 "둘러보다 발견하는 카탈로그 + 큐레이션" 으로 한 단계 더 나아간다.

### taste-like 대비 차별점
| 차원 | taste-like | DUPE |
|---|---|---|
| 홈 | 검색 + 스타일 모음 | **쇼핑몰형 매스너리 + 이번 주 듀프픽** |
| 결과 | 유사 상품 표시 | **현재 판매 중 + 구매 링크 (어필리에이트)** |
| 언어 | 한국어 | **한국어 + 영문 i18n** |
| 톤 | 기능형 | **시크 매거진 (브랜드 풀과 일치)** |

### 톤앤매너
- **시크 에디토리얼**: Times-style serif heading, Inter body. 흑·아이보리·먹먹한 골드.
- 여백·이미지·가격 콘트라스트가 콘텐츠.
- 이모지·과한 컬러·"!!!" 없음.

---

## 2. 사용자 흐름

### 주 흐름 (Push 큐레이션)
1. **홈** 진입 → 상단에 "이번 주 듀프픽" 배너 + 매스너리 디스커버리 피드
2. 핀 카드에 `Saint Laurent LE 5 À 7 · ₩4,200,000 → COS ₩159,000` 콘트라스트 노출
3. 카드 클릭 → **상세 페이지** 진입
4. 명품 1개 + 듀프 5개 (매치 % 포함) + 구매 버튼들
5. "구매 →" 클릭 → `/r/[link-id]` 리디렉트 → 어필리에이트 URL

### 보조 흐름 (Pull 검색)
1. 헤더 검색박스에 명품명 또는 URL 입력
2. URL 인 경우 → 백엔드가 메타 스크랩 → 매칭
3. 결과 = 상세 페이지

### 매거진 흐름
1. 홈 또는 nav 에서 "매거진" 진입
2. "Lemaire × COS 매주 픽 5개" 같은 큐레이션 글
3. 본문 안의 상품 카드 클릭 → 상세 페이지

---

## 3. 시스템 아키텍처

```
┌───────────┐    ┌───────────────────┐    ┌─────────────────┐
│ 브라우저   │ ──▶│ Next.js 14        │◀──▶│ Supabase        │
│ KR / EN   │    │ App Router        │    │ Postgres        │
└───────────┘    │ Tailwind + Framer │    │ + pgvector      │
                 │ next-intl         │    │ + Storage       │
                 └─────────┬─────────┘    │ + RLS / Auth    │
                           │              └────────┬────────┘
                           ▼                       │
                 ┌───────────────────┐             │
                 │ OpenAI            │◀────────────┘
                 │ GPT-4o-mini       │
                 │ + text-embed-3    │
                 └───────────────────┘
                           │
                           ▼
                 ┌───────────────────┐
                 │ 어필리에이트       │
                 │ Coupang Partners  │
                 │ Skimlinks         │
                 │ Amazon Associates │
                 └───────────────────┘
```

### 호스팅
- **Vercel**: Next.js + Edge Runtime + ISR + Image Optimization
- **Supabase**: Managed Postgres, Storage, Auth

---

## 4. 페이지 구조 (5개)

### 4.1 홈 `/`
- 상단 배너: "이번 주 듀프픽" (가장 최신 weekly_pick)
- 매스너리 그리드 (column-count 기반, 모바일 2, 데스크탑 4~5)
- 각 핀 = 명품 이미지 + 브랜드명 + 명품 가격(취소선) → 듀프 리테일러 + 듀프 가격
- 무한 스크롤 (페이지네이션 vs cursor)

### 4.2 카테고리 `/c/[category]`
- 가방 `/c/bags`, 신발 `/c/shoes`, 아우터 `/c/outerwear`
- 동일한 매스너리, 카테고리 필터 적용
- 정렬: 최신·인기·가격대

### 4.3 상세 `/p/[slug]`
- 헤더: 명품 이미지 + 메타 (브랜드·이름·가격·설명)
- "DUPE PICKS · 5" 섹션: 각 듀프 카드 (썸네일·브랜드·이름·가격·매치%·구매버튼)
- 하단: "비슷한 무드" (관련 핀 5개)
- JSON-LD: Product schema (명품 + 듀프 ItemList)

### 4.4 매거진 `/magazine` & `/magazine/[slug]`
- 컬렉션 글 목록 → 글 상세
- 본문 안에 상품 카드 임베드
- Article schema

### 4.5 어드민 `/admin/*`
- next-auth (Google OAuth · 화이트리스트 이메일)
- 명품 등록 (URL 또는 수동), 듀프 매칭 워크플로우, weekly_pick 발행, 매거진 작성

### 4.6 어필리에이트 리디렉트 `/r/[link-id]`
- 페이지가 아닌 라우트 핸들러
- click_events 기록 → 302 리디렉트

---

## 5. 데이터 모델

### 5.1 핵심 테이블

```sql
-- 브랜드
brands (
  id uuid pk,
  slug text unique,
  name text,
  tier text check (tier in ('luxury','spa')),
  country text,
  created_at timestamptz
)

-- 상품 (명품·SPA 통합)
products (
  id uuid pk,
  brand_id uuid fk brands,
  tier text check (tier in ('luxury','spa')), -- 쿼리 핫패스용 brands.tier 비정규화
  category text check (category in ('bags','shoes','outerwear')),
  slug text unique,
  name text,
  price_amount numeric,
  price_currency text,
  source_url text,        -- 원본 상품 페이지
  image_url text,         -- 우리 Supabase Storage 미러
  image_original_url text,
  embedding vector(1536), -- OpenAI text-embedding-3-small
  embedding_image vector(1024), -- CLIP/SigLIP (선택)
  status text check (status in ('draft','published','archived')),
  created_at timestamptz,
  published_at timestamptz
)

-- i18n
product_translations (
  product_id uuid fk products,
  locale text check (locale in ('ko','en')),
  name text,
  description text,
  primary key (product_id, locale)
)

-- 매칭 (핵심)
matches (
  id uuid pk,
  lux_id uuid fk products,
  dupe_id uuid fk products,
  score numeric,          -- 0.0 ~ 1.0
  editor_note text,       -- 짧은 큐레이터 코멘트
  rank smallint,          -- 1~5
  status text check (status in ('candidate','published','rejected')),
  created_at timestamptz,
  unique (lux_id, dupe_id)
)

-- 어필리에이트 링크
affiliate_links (
  id uuid pk,
  product_id uuid fk products,
  network text check (network in ('coupang','skimlinks','amazon','direct')),
  url text,
  click_count integer default 0,
  is_active boolean default true,
  created_at timestamptz
)

-- 이번 주 듀프픽
weekly_picks (
  id uuid pk,
  slug text unique,
  title text,
  banner_image_url text,
  product_ids uuid[],     -- 픽한 명품들
  published_at timestamptz,
  locale text             -- KR/EN 별도 발행 가능
)

-- 매거진 컬렉션
collections (
  id uuid pk,
  slug text unique,
  title text,
  body_markdown text,
  cover_image_url text,
  product_ids uuid[],
  published_at timestamptz,
  locale text
)

-- 익명 좋아요 (쿠키 기반)
likes (
  session_id text,
  product_id uuid fk products,
  created_at timestamptz,
  primary key (session_id, product_id)
)

-- 클릭 이벤트
click_events (
  id bigint pk,
  session_id text,
  affiliate_link_id uuid fk affiliate_links,
  referer text,
  user_agent text,
  ip_hash text,           -- 개인정보 보호
  created_at timestamptz
)
```

### 5.2 인덱스
- `products.embedding`: ivfflat (lists=100) — 유사도 쿼리
- `matches (lux_id, rank)` — 상세 페이지 조회
- `weekly_picks (published_at desc)` — 홈 배너
- `click_events (affiliate_link_id, created_at)` — 분석

---

## 6. 듀프 매칭 파이프라인

### 6.1 어드민 워크플로우 (사람 + AI 보조)

1. **명품 등록** — 어드민이 명품 URL 붙여넣기
   - 백엔드가 OG meta + JSON-LD 스크랩 → 이미지·이름·가격·설명 추출
   - 추출 실패 시 수동 입력 폼 폴백
   - `products.status = 'draft'` 로 저장

2. **임베딩 생성**
   - text: `name + description` → `text-embedding-3-small` (1536 차원)
   - image: 이미지 URL → 다운로드 → 임베딩 (선택: OpenCLIP/SigLIP, 1024 차원)
   - `products.embedding`, `embedding_image` 에 저장

3. **SPA 카탈로그 임베딩 풀**
   - 자라·COS·유니클로 인기 카테고리(가방·신발·아우터) ~2,000 개를 사전 스크랩·임베딩
   - 주 1회 배치 갱신
   - 카테고리별 별도 풀

4. **후보 추출** — pgvector 코사인 유사도 TOP 20
   ```sql
   select p.* from products p
   where p.tier = 'spa' and p.category = $1
   order by p.embedding <=> $2  -- 명품 벡터
   limit 20;
   ```

5. **GPT-4o-mini Vision 재랭킹** — taste-like 와 동일 가중치
   - 입력: 명품 이미지 + 설명, 후보 20개의 이미지 + 설명
   - 프롬프트: 이미지 7 : 설명 3 가중치로 듀프 적합도 평가 → TOP 5 + 점수
   - 출력 JSON: `[{dupe_id, score, reason}, ...]`

6. **어드민 검수** — 어드민 UI 에서
   - TOP 5 후보 + AI 점수 표시
   - 어드민이 픽 확정 (체크박스), `editor_note` 추가, `rank` 부여
   - "이번 주 픽" 또는 "매거진" 노출 결정
   - publish → `matches.status = 'published'`, `products.status = 'published'`

### 6.2 URL 붙여넣기 매칭 (유저 흐름)
1. 유저가 명품 URL 입력
2. 이미 등록된 상품이면 → 상세 페이지로 리디렉트
3. 아니면:
   - 백엔드가 메타 스크랩 (실패 시 에러 메시지)
   - 임시 임베딩 생성 + SPA 풀에서 코사인 유사도 TOP 5 (재랭킹 없음 — 비용 절감)
   - **읽기 전용 미리보기 페이지** `/preview/[hash]` 로 결과 표시 (검색 엔진 noindex)
   - "이 매칭이 좋은가요?" 피드백 버튼 → 어드민 큐에 후보로 적재
   - 어드민이 검수·발행해야 영구 페이지로 승격

---

## 7. 어필리에이트 트래킹

### 7.1 흐름
1. 유저가 듀프 카드 "구매 →" 클릭
2. 우리 도메인 `/r/[link-id]` 로 이동
3. 라우트 핸들러:
   - `affiliate_links.click_count += 1`
   - `click_events` insert (session_id 쿠키, referer, hashed ip)
   - 302 redirect → `affiliate_links.url`
4. 어필리에이트 네트워크 콜백으로 실 구매 검증 (별도 webhook 엔드포인트)

### 7.2 네트워크 매핑
| 리테일러 | 네트워크 | 비고 |
|---|---|---|
| 자라 KR / COS KR / 유니클로 KR | 직접 제휴 또는 Awin/CJ Affiliate | 한국 (쿠팡파트너스는 쿠팡 셀러만 가능 — 제외) |
| Zara US / COS US / Uniqlo US | Skimlinks 또는 Awin | 글로벌 |
| Amazon (직구) | Amazon Associates | 글로벌 |
| 그 외 (29CM·무신사 등) | 카페24·플레이오토 어필리에이트 | 한국 보조 |
| 폴백 | direct (커미션 없음) | 미가입 리테일러 |

**노트**: 자라/COS/유니클로는 한국 어필리에이트 가입 가능 여부를 런칭 전 검증 필요 (오픈 이슈 #1 참조).

### 7.3 KPI
- 핵심 지표: **affiliate CTR** (상세 페이지 노출 → 구매 클릭)
- 보조: 페이지뷰, 듀프 픽 노출률, 매거진 완독률

---

## 8. i18n 전략

### 8.1 라우팅
- `dupe.kr/` = 한국어 (기본)
- `dupe.kr/en/` = 영문
- `next-intl` 미들웨어로 locale 감지·라우팅
- 정적 콘텐츠 (코어 UI) → JSON 메시지 카탈로그 (`messages/ko.json`, `messages/en.json`)
- 동적 콘텐츠 (상품·매거진) → `product_translations` / `collections.locale` 컬럼

### 8.2 SEO
- 페이지마다 `<link rel="alternate" hreflang="ko" />`, `hreflang="en"`
- `sitemap.xml` 에 한·영 URL 모두 포함
- 메타 description, OG 태그 locale 별 분리

### 8.3 큐레이션 분리
- weekly_picks·collections 는 locale 별 별도 발행
- "이번 주 듀프픽" (KR) 과 "This Week's Picks" (EN) 은 다를 수 있음

---

## 9. 비기능 요구사항

### 9.1 성능
- 홈 LCP < 2.0s, 상세 LCP < 1.5s
- Next.js ISR `revalidate: 3600` (1시간) — 홈·상세
- Vercel Image Optimization (AVIF/WebP)
- pgvector 쿼리 < 100ms (인덱스 적용)

### 9.2 SEO
- 상세 페이지 = "Saint Laurent LE 5 À 7 듀프", "Lemaire Croissant Dupe Zara" 같은 long-tail
- JSON-LD: Product, ItemList, Article, BreadcrumbList
- 매거진은 Article schema

### 9.3 분석
- Vercel Analytics (코어 웹 바이탈)
- Plausible (페이지뷰·이벤트)
- 핵심 이벤트: `search`, `detail_view`, `affiliate_click`, `like_add`

### 9.4 보안
- 어드민: next-auth Google OAuth + `ADMIN_EMAILS` 환경변수 화이트리스트
- Supabase RLS: 일반 테이블은 `select` 만 익명 허용, 쓰기는 service role 또는 관리자
- 어드민 라우트 미들웨어 보호
- ip 는 해시(sha256+salt)만 저장

### 9.5 저작권 & 법적
- 명품 이미지는 우리 Storage 에 미러 (디스플레이 최소 크기, 출처 URL 항상 표시)
- 어필리에이트 약관에 따른 사용 범위 준수
- 리테일러 robots.txt 존중
- "Dupe is not a counterfeit" 디스클레이머 (footer)

---

## 10. MVP 범위 (B Standard)

### 포함
- 홈·카테고리·상세·매거진·어드민 페이지
- KR/EN i18n
- URL 매칭 (Pull)
- 익명 좋아요 (쿠키)
- 어필리에이트 링크 + 클릭 트래킹
- 듀프 50~150 쌍 시드 데이터
- weekly_picks 4~6 개 (런칭 첫 1.5개월분)

### 제외 (v2)
- 회원가입·로그인 (일반 유저)
- 개인 보드·위시리스트
- 실시간 재고 체크 (수동 archive 만)
- 자동 임베딩 파이프라인 (어드민이 트리거)
- 푸시·이메일 알림

---

## 11. 오픈 이슈 & 리스크

| # | 이슈 | 영향 | 완화책 |
|---|---|---|---|
| 1 | 자라/COS/유니클로 어필리에이트 가입 가능 여부 (한국) | 高 | 런칭 전 검증. 미가입 시 Skimlinks 글로벌 라우팅으로 폴백 |
| 2 | SPA 카탈로그 스크랩 합법성 | 高 | 공식 API 우선 (Zara/COS API 부재 시 robots.txt 준수 + UA 식별) |
| 3 | 명품 이미지 저작권 | 中 | 어필리에이트 약관 내 사용, 출처 명시 |
| 4 | GPT-4o-mini Vision 비용 | 中 | 매칭은 어드민 트리거만 (유저당 호출 없음), 배치 처리 |
| 5 | 어필리에이트 한국 → 글로벌 전환 | 中 | 리테일러 IP detection 으로 KR/US 링크 동적 선택 |
| 6 | 듀프 품질 (false positive) | 高 | 어드민 검수 게이트 필수 (자동 발행 X) |
| 7 | 콜드 스타트 (낮은 트래픽) | 中 | 매거진 SEO + 인스타·X 운영 |
| 8 | URL 매칭 어뷰즈 (스크랩 봇 호출) | 中 | rate limit (분당 5회 IP) + Cloudflare Turnstile 캡차 |

---

## 12. 기술 스택 요약

| 영역 | 기술 |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, Framer Motion, next-intl |
| State | React Server Components + URL state. 클라이언트 상태 최소화 |
| Backend | Supabase Postgres + pgvector + Storage |
| Auth | next-auth (Google OAuth, 어드민 전용) |
| AI | OpenAI GPT-4o-mini Vision + text-embedding-3-small |
| Hosting | Vercel (Next.js), Supabase Cloud |
| Analytics | Vercel Analytics + Plausible |
| Dev | TypeScript, ESLint, Prettier, Vitest, Playwright |

---

## 13. 마일스톤 (4~6주)

1. **Week 1** — 셋업: Next.js + Supabase + 마이그레이션, 디자인 시스템 토큰, i18n 골격
2. **Week 2** — 어드민 (auth + 명품 등록 + 임베딩 파이프라인 + 매칭 UI)
3. **Week 3** — 공개 페이지 (홈 매스너리, 카테고리, 상세, 매거진)
4. **Week 4** — 어필리에이트 + 클릭 트래킹 + URL 매칭 + 좋아요
5. **Week 5** — SEO, 성능, 분석, KR/EN 콘텐츠 채우기 (150쌍 + 4 weekly_picks)
6. **Week 6** — QA, 베타, 어필리에이트 네트워크 등록, 도메인 연결, 런칭
