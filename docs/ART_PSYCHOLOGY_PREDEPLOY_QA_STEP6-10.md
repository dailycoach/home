# DAILYCOACHING 미술심리코칭 리빌딩 — 배포 전 QA 보고서

작성일: 2026-07-28  
상태: **구현 및 정적 QA 통과 / 실제 배포 대기**

## 1. 배포 판단

전체 디자인 확장과 자료 정합성 검수는 통과했습니다. 다만 참여 신청 주소가 아직 비어 있으므로 실제 배포 전 아래 둘 중 하나가 필요합니다.

1. `config.js`에 연결할 Google Forms 주소 제공
2. 신청 버튼이 임시 안내 대화상자를 여는 상태로 배포한다는 명시적 승인

현재 운영 페이지에는 이 브랜치의 변경을 배포하지 않았습니다.

- 배포 예정 주소: `https://daily-coach-ing.com/programs/art-psychology-coaching/`
- 작업 브랜치: `agent/art-psychology-individuality-rebuild`
- 전체 구현 커밋: `6ca74aa64bc1c3b563e283bcc86f6887d1289429`
- 대표 시안 커밋: `f445782f29ee0479cee20a379cbb7e22d0c66797`
- 롤백 기준: `ada114534d9f7ddb740354999f3def42c3d77611`
- 원격 반영·배포: 미실행

## 2. 페이지별 변경 사항

### 랜딩 `index.html`

- “다양한 빛깔, 나만의 존재감”을 대형 에디토리얼 Hero로 구성
- 차콜·코발트 중심의 비정형 콜라주와 고유성 라벨 적용
- 내면/외면의 대비를 겹치는 레이어 구조로 시각화
- 6주 여정, 활동 흔적, 재구성 발화 예시, 진행 철학, 최종 CTA까지 확장
- 후기처럼 오해되지 않도록 활동 이미지와 발화를 모두 재구성 예시로 명시
- 제공된 인물 이미지를 바탕으로 생성한 현대미술 콜라주형 전문가 프로필을 WebP로 최적화해 적용

### 6주 과정 `journey.html`

- 동일 카드 6개 대신 크기·밀도·색이 다른 여섯 장면으로 구성
- 회기당 120분의 7단계 리듬 명시
- 6개 주차 모두 핵심 질문, 한 줄 경험, 활동 장면, 펼치기 정보 제공
- 진단·사실 판정·결과 보장 없이 현재 자기이해와 다음 행동에 연결

### 참여 안내 `guide.html`

- 참여자 화면, 스케치북, 워크북을 FIELD KIT 언어로 분리
- 현장 준비, 참여 방식, 참여자의 다섯 가지 선택권, FAQ 구성
- 박지아 코치의 인물 이미지, 전문 분야, 자격, 진행 원칙을 비대칭 에디토리얼 프로필로 구성
- 작품을 대신 해석하지 않는 원칙과 정서 반응 시 안전 대응 범위 명시

### 강사용 자료실 `slides.html`

- 공개 페이지와 구분되는 PRIVATE FIELD DESK 디자인 적용
- `6주 × 19장 = 114장`, `120분/회기` 규격을 첫 화면과 보호 화면에 명시
- 19장 공통 흐름과 6주 진행 개요를 운영형 레이아웃으로 재구성
- 비밀번호 `250409`의 SHA-256 검증과 세션 잠금 유지
- 다운로드 경로를 인증 전 HTML에서 제거하고 인증 성공 후 12개 링크에 주입
- `noindex,nofollow,noarchive` 유지

### 이전 주소 `course.html`

- 기존 주소를 유지하고 `journey.html`로 검색어·해시와 함께 이동

## 3. 공식 디자인 토큰

| 토큰 | 값 | 주요 역할 |
|---|---:|---|
| `--color-charcoal` | `#232735` | 본문, 헤더, 어두운 편집 섹션 |
| `--color-warm-gray` | `#F7F1F0` | 기본 배경과 여백 |
| `--color-soft-pink` | `#F2B7C6` | 감정 온도, 인용, 장면 전환 |
| `--color-cobalt` | `#3E5BD6` | CTA, 링크, 숫자, 핵심 대비 |
| `--color-lime` | `#A8C65B` | 성장, 발견, 진행 포인트 |
| `--color-coral` | `#FF8A5B` | 작은 행동·상태 강조 |

제목은 로컬 `Gowun Batang 700`, 본문은 Pretendard/SUIT/Noto Sans KR/시스템 폰트 순서의 fallback stack을 사용합니다.

## 4. 변경 파일

### 페이지·동작

- `programs/art-psychology-coaching/index.html`
- `programs/art-psychology-coaching/journey.html`
- `programs/art-psychology-coaching/guide.html`
- `programs/art-psychology-coaching/slides.html`
- `programs/art-psychology-coaching/course.html`
- `programs/art-psychology-coaching/app.js`
- `programs/art-psychology-coaching/slides-auth.js`
- `programs/art-psychology-coaching/styles.css`
- `programs/art-psychology-coaching/slides.css`

### 이미지·폰트

- `assets/hero-identity-collage.webp`
- `assets/artwork-self-layers.webp`
- `assets/artwork-future-scene.webp`
- `assets/artwork-support-symbol.webp`
- `assets/fonts/gowun-batang-700.woff2`
- `assets/fonts/GOWUN_BATANG_LICENSE.txt`
- 이전 `assets/identity-collage.svg` 제거

### 자동 검수

- `scripts/check-art-psychology-representative.mjs`
- `scripts/check-art-psychology-site.mjs`

## 5. 기능·자료 QA

| 검수 항목 | 결과 |
|---|---|
| 로컬 라우트 및 앵커 5개 | 통과 |
| HTTP 응답 핵심 경로 12개 | 모두 `200` |
| HTML 구조 검증 | 통과 |
| CSS 구문 검증 | 통과 |
| JavaScript 구문 검증 | 통과 |
| 6주 과정 주차 수 | 6개 통과 |
| 강사용 공통 진행 흐름 | 19개 통과 |
| MASTER PPTX | 슬라이드 114장 + 발표자 노트 114개 |
| 주차별 PPTX 6개 | 각각 슬라이드 19장 + 발표자 노트 19개 |
| MASTER PDF | 114페이지 |
| 강사대본 TXT | UTF-8 BOM, 깨진 대체문자 없음 |
| 강사대본 레코드 | 114개 |
| 실제 발화·대체 질문·안전 대응·워크북 코드 | 각각 114개 |
| 전체 ZIP | MASTER·주차별 PPT 6개·강사대본 일치 |
| 인증 후 다운로드 매핑 | 12개 통과 |
| 비밀번호 `250409` | 해시 일치 |
| 내부 로컬 링크·파일 | 누락 없음 |
| 금지된 효과·고정 해석 문구 | 없음 |

실행 명령:

```bash
node scripts/check-art-psychology-representative.mjs
node scripts/check-art-psychology-site.mjs
npx --yes --cache /tmp/dailycoaching-npm-cache html-validate@10.2.1 programs/art-psychology-coaching/*.html
npx --yes --cache /tmp/dailycoaching-npm-cache csstree-validator programs/art-psychology-coaching
```

## 6. 접근성 QA

- `lang="ko"`, viewport, H1→H2→H3 제목 흐름 확인
- 건너뛰기 링크와 키보드 focus-visible 적용
- 모바일 메뉴 Escape 닫기와 포커스 복귀 적용
- 최소 44px 이상 터치 영역 적용
- 본문 모바일 16px 적용
- 모든 콘텐츠 이미지에 alt, 장식 이미지는 빈 alt 적용
- 이미지 width/height 사전 지정 및 하단 이미지 lazy loading 적용
- `prefers-reduced-motion` 대응
- 색상만으로 상태를 구분하지 않도록 번호·텍스트 병행

핵심 명도 대비:

| 조합 | 대비 |
|---|---:|
| 코발트 CTA / 흰색 | 5.72:1 |
| 코발트 hover / 흰색 | 7.66:1 |
| Warm Gray / 차콜 본문 | 13.30:1 |
| Warm Gray / muted 본문 | 6.18:1 |
| 핑크 / 차콜 | 8.75:1 |
| 라임 / 차콜 | 7.71:1 |
| 코랄 / 차콜 | 6.40:1 |

모든 핵심 조합이 WCAG AA 일반 텍스트 기준을 통과했습니다.

## 7. 반응형 범위

CSS에서 `1100px`, `980px`, `760px`, `420px` 기준을 적용했으며 다음을 별도 처리했습니다.

- Hero 제목 크기와 콜라주 재배치
- 6주 콘텐츠의 세로 흐름 변환
- FIELD KIT와 활동 이미지 단일 열 전환
- 강사용 19장 흐름 5열→3열→2열→1열 전환
- 고정 신청 버튼이 콘텐츠를 가리지 않도록 본문·푸터 여백 확보
- `overflow-x: hidden`과 고정 이미지 비율 적용

## 8. 남은 제한 사항

1. **참여 신청 URL**
   - `config.js`의 `formUrl`이 빈 값입니다.
   - 현재 버튼은 오류가 아니라 “구글설문 링크 연결 전” 안내 대화상자를 엽니다.
   - 신청 흐름을 완성하려면 실제 Google Forms 주소가 필요합니다.

2. **실제 화면 캡처**
   - 현재 실행 환경에서 브라우저 렌더러가 정상 기동되지 않아 360·390·412·768·1024·1440px PNG 캡처를 만들지 못했습니다.
   - HTML/CSS 정적 검수는 통과했지만, 배포 직후 실제 브라우저 육안 확인이 필요합니다.

3. **정적 호스팅의 인증 한계**
   - 강사용 화면은 비밀번호·세션 게이트를 유지하고 다운로드 주소를 인증 후에만 DOM에 주입합니다.
   - GitHub Pages는 서버 권한 인증이 아니므로 파일 URL을 이미 아는 사용자의 직접 접근까지 막지는 못합니다.

## 9. 배포 전 승인 요청 범위

아래 두 항목을 확인한 뒤 배포합니다.

- 참여 신청 URL을 제공하거나 임시 안내 상태를 승인
- 브랜치 `agent/art-psychology-individuality-rebuild`의 메인 반영 및 운영 배포 승인

배포 후에는 운영 주소에서 라우트, 신청 버튼, 비밀번호, 다운로드, 모바일 메뉴, 콘솔 오류, 404를 다시 확인하고 최종 배포 커밋과 운영 캡처를 기록합니다.
