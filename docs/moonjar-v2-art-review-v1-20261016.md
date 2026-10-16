# 달항아리 PORCELAIN V2 · 실제 시안 리뷰 v1

2026-10-16 · **시안 제작 및 로컬 QA 완료 / 사용자 시각 검토 전 / 기존 웹앱 미통합·미배포**

## 원본 제작 사실
기존 자체 제작 도안 `canvas_light.png` / `canvas_dark.png`와 원본 자개 8색상군 96조각을 참고하여, 특정 박물관 소장품 사진을 사용하지 않은 독립적인 백자 낮/달빛 밤 실루엣과 질감 마스터를 새로 제작했다.

이 채팅에서 납품한 패키지: `moonjar_porcelain_V2_design_review.zip`  
**주의:** 샌드박스 파일은 GitHub 트리에 자동 등록되지 않는다. PR #190에는 감사와 설계 정본만 먼저 올렸다. 패키지의 SVG·PNG 바이너리는 사용자 시각 검토 후 신규 경로 `assets/moonjar-v2/`에 별도로 등록하여야 한다.

## 산출물(실제 생성됨)
| 파일 | 용도 | 검사 |
|---|---|---|
| `master/porcelain-day.svg` | Daylight 수정 가능 오리지널 벡터 | 편집가능 XML / 외부 사진 링크 없음 |
| `master/porcelain-night.svg` | Moonlit 수정 가능 오리지널 벡터 | 낮/밤 동일 윤곽 shape |
| `porcelain-day.png` | 1600×1800 아트워크 | SHA256 `3291e02097dcf6a09a1d52133bbec285a1e64af6caa776689e10e7d3131f2f48` |
| `porcelain-night.png` | 1600×1800 아트워크 | SHA256는 패키지 variants.json에서 확인 |
| `thumbnail-{day,night}.webp` | 400×450 디자인 선택 미리보기 | 해상도 통과 |
| `qa/01_before_after_empty.png` | 기존/신규 빈 작품 4면 비교 | 생성 완료 |
| `qa/02_before_after_24.png` | 8색상군×3조각: 기존/신규 비교 | 생성 완료 |
| `qa/03_before_after_8.png` | 자유배치 조각 포함 샘플 작품 | 생성 완료 |
| `qa/04_8-color_day_night.png` | V2 낮·밤 품질 비교 | 생성 완료 |
| `qa/technical-verification.json` | PNG 크기·색 프로필·SHA 등 | **27/27 PASS** |

## 미술 평가(정성)
**개선:** 기존 균일한 윤곽선보다 좁은 입구, 풍성한 몸통, 보이는 유백색 바탕과 굽, 미세한 음영·광원으로 '백자'의 재질감이 분명해졌다. 야간에도 몸체가 검은 배경 속에서 사라지지 않는다. 빈 그릇도 하나의 작품처럼 보일 수 있어 여백을 남기는 활동에 적합하다.

**미완성/반영 전 검토:** 매우 밝은 진주빛 자개가 백자 고명도 영역에서 대비가 약해질 수 있다. 화면을 320px로 축소했을 때 자개 경계, 과도한 표면 입자감, 작업 프레임의 중복 그림자를 추가 평가해야 한다. 작고 다양한 자개가 놓인 결과 카드 전체의 타이포와 백자 배경 사이도 조정할 수 있다.

## 기존 프로젝트 보호(운영 BLOCK)
- 기존 두 배경 PNG와 `outline-v3` scene 데이터를 덮어쓰지 않음.
- 기존 자개 PNG 96개·썸네일 96개 바이너리 손상/보정 금지.
- `schema.json`은 additionalProperties:false, `templateId:outline-v3`, theme light/dark 전제이므로 신규 V2 바탕 선택을 스키마·렌더러·저장/스냅샷에 일괄 반영해야 한다.
- 이번 패키지는 작품/카드에서 신규 V2 PNG를 **사전 합성한 정적 미술 시뮬레이션**이지 앱 기능의 동작 검증 결과가 아니다.
- V2 선택 UI·프로젝트 마이그레이션·실기기 UX·운영 배포는 아직 하지 않았다.

## 다음 승인 게이트
운영자 시각 검토 → 앱에 신규 바탕을 개별 variant로 등록 → 기존 JSON/스냅샷 하위 호환 검증 → SVG/PNG/카드/인쇄 일치 검증 → 모바일 실기기와 96색 QA → 배포 승인.

전체 수정구간과 공통 수용 기준은 `docs/moonjar-v2-full-audit-20261016.md` 및 `docs/moonjar-v2-background-master-work-order-20261016.md`를 따른다.
