# LMC 77개 PART별 Zoom 마스킹 구간표 v1.0

## 적용 기준

- 시간은 **각 분할 MP4 자체의 로컬 타임코드**다.
- PART 경계는 `LMC_77_UPLOAD_MANIFEST_FINAL.json`의 `actualDurationSeconds`를 WEEK별로 누적해 환산했다.
- `RIGHT_PANEL`은 안전 시작 x부터 프레임 우측 끝까지, y 전체(0–719)를 불투명 검정으로 가린다.
- `FULL_FRAME`은 화면 전체를 불투명 검정으로 가린다.
- WEEK 끝까지 이어지는 마스크는 컨테이너 타임스탬프의 미세한 초과 구간까지 안전하게 덮기 위해 해당 PART의 `END`까지 적용한다.
- Codex 렌더 직전 전환점 ±1초 프레임 재검수는 별도 게이트로 유지한다.

| # | WEEK-PART | 파일 | 길이 | 마스킹 구간 (PART 로컬시간) | 위치 |
|---:|---|---|---:|---|---|
| 1 | W01-P01 | `LMC_WEEK01_P01_self-concept-and-sources.mp4` | `00:20:20.04` | `00:00:09.50–END` · RIGHT_PANEL | `RIGHT_PANEL x=1123–1279, y=0–719` |
| 2 | W01-P02 | `LMC_WEEK01_P02_motivation-and-self-esteem.mp4` | `00:14:00.08` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1123–1279, y=0–719` |
| 3 | W01-P03 | `LMC_WEEK01_P03_self-defense-acceptance-disclosure.mp4` | `00:21:30.16` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1123–1279, y=0–719` |
| 4 | W01-P04 | `LMC_WEEK01_P04_impression-formation.mp4` | `00:26:10.04` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1123–1279, y=0–719` |
| 5 | W01-P05 | `LMC_WEEK01_P05_similarity-and-complementarity.mp4` | `00:23:53.65` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1123–1279, y=0–719` |
| 6 | W02-P01 | `LMC_WEEK02_P01_aptitude-structure-and-multifactor-analysis.mp4` | `00:23:50.88` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 7 | W02-P02 | `LMC_WEEK02_P02_difficulties-and-integrated-test-analysis.mp4` | `00:19:44.76` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 8 | W02-P03 | `LMC_WEEK02_P03_comprehensive-aptitude-and-personality-theories.mp4` | `00:17:20.84` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 9 | W02-P04 | `LMC_WEEK02_P04_rs-tests-and-cipp-platform.mp4` | `00:23:15.68` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 10 | W02-P05 | `LMC_WEEK02_P05_result-report-interpretation-practice.mp4` | `00:20:30.56` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 11 | W02-P06 | `LMC_WEEK02_P06_member-management-and-data-use.mp4` | `00:11:21.92` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 12 | W02-P07 | `LMC_WEEK02_P07_ai-assisted-career-interpretation.mp4` | `00:16:36.93` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 13 | W03-P01 | `LMC_WEEK03_P01_course-introduction-and-personality-definition.mp4` | `00:18:36.76` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 14 | W03-P02 | `LMC_WEEK03_P02_personality-characteristics-and-importance.mp4` | `00:15:05.05` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 15 | W03-P03 | `LMC_WEEK03_P03_trait-and-process-theories.mp4` | `00:15:15.02` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 16 | W03-P04 | `LMC_WEEK03_P04_personality-perspectives-01.mp4` | `00:15:04.88` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 17 | W03-P05 | `LMC_WEEK03_P05_personality-perspectives-02.mp4` | `00:15:09.29` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 18 | W03-P06 | `LMC_WEEK03_P06_cattell-trait-theory-and-16pf.mp4` | `00:18:37.17` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 19 | W03-P07 | `LMC_WEEK03_P07_16pf-report-interpretation-practice.mp4` | `00:12:30.52` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 20 | W03-P08 | `LMC_WEEK03_P08_ai-assisted-interpretation-and-platform.mp4` | `00:10:16.51` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 21 | W04-P01 | `LMC_WEEK04_P01_communication-concept-and-structure.mp4` | `00:15:36.96` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |
| 22 | W04-P02 | `LMC_WEEK04_P02_communication-functions-and-expression.mp4` | `00:18:10.56` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |
| 23 | W04-P03 | `LMC_WEEK04_P03_ten-types-and-assessment-criteria.mp4` | `00:13:59.68` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |
| 24 | W04-P04 | `LMC_WEEK04_P04_type-characteristics-interpretation.mp4` | `00:13:28.96` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |
| 25 | W04-P05 | `LMC_WEEK04_P05_case-application-and-summary.mp4` | `00:11:15.84` | `00:00:00.00–00:00:17.84` · RIGHT_PANEL<br>`00:11:06.34–00:11:08.84` · RIGHT_PANEL<br>`00:11:08.84–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719`<br>`RIGHT_PANEL x=1059–1279, y=0–719`<br>`RIGHT_PANEL x=1005–1279, y=0–719` |
| 26 | W04-P06 | `LMC_WEEK04_P06_report-and-platform-use.mp4` | `00:07:08.34` | `00:00:00.00–00:00:26.50` · RIGHT_PANEL<br>`00:00:26.50–END` · RIGHT_PANEL | `RIGHT_PANEL x=1005–1279, y=0–719`<br>`RIGHT_PANEL x=1080–1279, y=0–719` |
| 27 | W05-P01 | `LMC_WEEK05_P01_stress-definition-and-core-characteristics.mp4` | `00:21:19.48` | `00:01:23.50–END` · RIGHT_PANEL | `RIGHT_PANEL x=1027–1211, y=0–719` |
| 28 | W05-P02 | `LMC_WEEK05_P02_positive-negative-stress-and-theories.mp4` | `00:14:24.08` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1027–1211, y=0–719` |
| 29 | W05-P03 | `LMC_WEEK05_P03_rs-stress-assessment-causes.mp4` | `00:12:14.97` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1027–1211, y=0–719` |
| 30 | W05-P04 | `LMC_WEEK05_P04_stress-symptoms-and-physiological-response.mp4` | `00:16:58.00` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1027–1211, y=0–719` |
| 31 | W05-P05 | `LMC_WEEK05_P05_coping-types-and-management-strategies.mp4` | `00:08:36.37` | `00:00:00.00–00:08:35.96` · RIGHT_PANEL | `RIGHT_PANEL x=1027–1211, y=0–719` |
| 32 | W05-P06 | `LMC_WEEK05_P06_stress-case-application-01.mp4` | `00:15:46.01` | **NO MASK** | — |
| 33 | W05-P07 | `LMC_WEEK05_P07_stress-case-application-02.mp4` | `00:18:19.92` | **NO MASK** | — |
| 34 | W05-P08 | `LMC_WEEK05_P08_case-integration-and-result-review.mp4` | `00:13:32.42` | `00:12:10.16–END` · RIGHT_PANEL | `RIGHT_PANEL x=1008–1211, y=0–719` |
| 35 | W06-P01 | `LMC_WEEK06_P01_course-introduction-and-learning-style.mp4` | `00:18:39.44` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 36 | W06-P02 | `LMC_WEEK06_P02_cognitive-affective-environmental-learning-style.mp4` | `00:19:28.26` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 37 | W06-P03 | `LMC_WEEK06_P03_five-affective-learning-factors.mp4` | `00:12:01.45` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 38 | W06-P04 | `LMC_WEEK06_P04_jungian-learning-personality.mp4` | `00:11:07.77` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 39 | W06-P05 | `LMC_WEEK06_P05_learner-types-and-brain-functions.mp4` | `00:14:23.85` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 40 | W06-P06 | `LMC_WEEK06_P06_learning-style-report-practice.mp4` | `00:17:57.41` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 41 | W06-P07 | `LMC_WEEK06_P07_learning-emotion-and-platform-use.mp4` | `00:18:17.98` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 42 | W07-P01 | `LMC_WEEK07_P01_emotion-assessment-overview-and-result-graph.mp4` | `00:18:36.04` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1085–1279, y=0–719` |
| 43 | W07-P02 | `LMC_WEEK07_P02_case-interpretation-scores-and-responses.mp4` | `00:16:26.97` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1085–1279, y=0–719` |
| 44 | W07-P03 | `LMC_WEEK07_P03_case-interpretation-context-and-patterns.mp4` | `00:19:58.02` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1085–1279, y=0–719` |
| 45 | W07-P04 | `LMC_WEEK07_P04_case-integration-and-coaching-application.mp4` | `00:15:08.82` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1085–1279, y=0–719` |
| 46 | W07-P05 | `LMC_WEEK07_P05_social-anxiety-and-loneliness.mp4` | `00:18:36.08` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1085–1279, y=0–719` |
| 47 | W07-P06 | `LMC_WEEK07_P06_anger-causes-functions-and-effects.mp4` | `00:16:17.05` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1085–1279, y=0–719` |
| 48 | W07-P07 | `LMC_WEEK07_P07_aggression-lethargy-inferiority-and-report.mp4` | `00:16:49.35` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1085–1279, y=0–719` |
| 49 | W08-P01 | `LMC_WEEK08_P01_happiness-depression-assessment-and-classification.mp4` | `00:18:26.08` | `00:01:33.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1132–1279, y=0–719` |
| 50 | W08-P02 | `LMC_WEEK08_P02_mood-curve-and-mood-episodes.mp4` | `00:14:55.13` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1132–1279, y=0–719` |
| 51 | W08-P03 | `LMC_WEEK08_P03_major-depression-criteria-and-characteristics.mp4` | `00:09:29.85` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1132–1279, y=0–719` |
| 52 | W08-P04 | `LMC_WEEK08_P04_biological-and-psychosocial-causes.mp4` | `00:15:31.12` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1132–1279, y=0–719` |
| 53 | W08-P05 | `LMC_WEEK08_P05_symptoms-assessment-treatment-and-results.mp4` | `00:09:51.38` | `00:00:00.00–00:05:00.32` · RIGHT_PANEL<br>`00:06:19.82–00:06:25.32` · FULL_FRAME<br>`00:06:25.32–END` · RIGHT_PANEL | `RIGHT_PANEL x=1132–1279, y=0–719`<br>`FULL_FRAME x=0–1279, y=0–719`<br>`RIGHT_PANEL x=1083–1279, y=0–719` |
| 54 | W08-P06 | `LMC_WEEK08_P06_six-symptom-scales-and-interpretation.mp4` | `00:16:48.10` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1083–1279, y=0–719` |
| 55 | W08-P07 | `LMC_WEEK08_P07_symptom-scale-case-application.mp4` | `00:15:45.30` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1083–1279, y=0–719` |
| 56 | W08-P08 | `LMC_WEEK08_P08_report-and-assessment-platform.mp4` | `00:05:05.69` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1083–1279, y=0–719` |
| 57 | W09-P01 | `LMC_WEEK09_P01_abnormal-psychology-and-boundaries.mp4` | `00:18:00.12` | `00:00:00.00–00:00:47.50` · FULL_FRAME<br>`00:00:47.50–END` · RIGHT_PANEL | `FULL_FRAME x=0–1279, y=0–719`<br>`RIGHT_PANEL x=1189–1279, y=0–719` |
| 58 | W09-P02 | `LMC_WEEK09_P02_judgment-criteria-reality-adaptation-statistics.mp4` | `00:18:00.09` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1189–1279, y=0–719` |
| 59 | W09-P03 | `LMC_WEEK09_P03_sociocultural-criteria-and-icd-dsm.mp4` | `00:13:53.04` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1189–1279, y=0–719` |
| 60 | W09-P04 | `LMC_WEEK09_P04_theoretical-and-treatment-approaches.mp4` | `00:13:38.58` | `00:00:00.00–00:12:08.75` · RIGHT_PANEL<br>`00:12:08.75–00:13:08.75` · FULL_FRAME<br>`00:13:08.75–END` · RIGHT_PANEL | `RIGHT_PANEL x=1189–1279, y=0–719`<br>`FULL_FRAME x=0–1279, y=0–719`<br>`RIGHT_PANEL x=1152–1279, y=0–719` |
| 61 | W09-P05 | `LMC_WEEK09_P05_seven-scales-core-concepts.mp4` | `00:20:04.26` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1152–1279, y=0–719` |
| 62 | W09-P06 | `LMC_WEEK09_P06_seven-scales-causes-and-effects.mp4` | `00:19:58.01` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1152–1279, y=0–719` |
| 63 | W09-P07 | `LMC_WEEK09_P07_seven-scales-case-integration.mp4` | `00:21:22.83` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1152–1279, y=0–719` |
| 64 | W10-P01 | `LMC_WEEK10_P01_couple-assessment-profile.mp4` | `00:18:32.24` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 65 | W10-P02 | `LMC_WEEK10_P02_case-strengths-and-relationship-resources.mp4` | `00:18:06.96` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 66 | W10-P03 | `LMC_WEEK10_P03_case-low-factors-and-adjustment.mp4` | `00:18:40.20` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 67 | W10-P04 | `LMC_WEEK10_P04_case-integration-and-couple-coaching.mp4` | `00:19:18.56` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 68 | W10-P05 | `LMC_WEEK10_P05_assessment-overview-and-marital-satisfaction.mp4` | `00:11:46.72` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 69 | W10-P06 | `LMC_WEEK10_P06_thirteen-factors-and-criteria.mp4` | `00:13:04.60` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 70 | W10-P07 | `LMC_WEEK10_P07_report-interpretation-and-platform.mp4` | `00:15:36.73` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1059–1279, y=0–719` |
| 71 | W11-P01 | `LMC_WEEK11_P01_development-profile-and-factors.mp4` | `00:16:59.64` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |
| 72 | W11-P02 | `LMC_WEEK11_P02_youth-physical-self-image-self-regulation.mp4` | `00:16:55.20` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |
| 73 | W11-P03 | `LMC_WEEK11_P03_youth-academic-efficacy-identity-independence.mp4` | `00:14:09.40` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |
| 74 | W11-P04 | `LMC_WEEK11_P04_adult-development-and-assessment-structure.mp4` | `00:13:33.80` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |
| 75 | W11-P05 | `LMC_WEEK11_P05_assessment-structure-and-youth-case.mp4` | `00:14:21.20` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |
| 76 | W11-P06 | `LMC_WEEK11_P06_lifespan-comparison-and-integration.mp4` | `00:13:45.52` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |
| 77 | W11-P07 | `LMC_WEEK11_P07_adult-factors-report-and-summary.mp4` | `00:14:56.93` | `00:00:00.00–END` · RIGHT_PANEL | `RIGHT_PANEL x=1080–1279, y=0–719` |

## 특별 전환 PART

- **W01-P01** `LMC_WEEK01_P01_self-concept-and-sources.mp4` → 00:00:09.50–END RIGHT_PANEL RIGHT_PANEL x=1123–1279, y=0–719
- **W04-P05** `LMC_WEEK04_P05_case-application-and-summary.mp4` → 00:00:00.00–00:00:17.84 RIGHT_PANEL RIGHT_PANEL x=1080–1279, y=0–719; 00:11:06.34–00:11:08.84 RIGHT_PANEL RIGHT_PANEL x=1059–1279, y=0–719; 00:11:08.84–END RIGHT_PANEL RIGHT_PANEL x=1005–1279, y=0–719
- **W04-P06** `LMC_WEEK04_P06_report-and-platform-use.mp4` → 00:00:00.00–00:00:26.50 RIGHT_PANEL RIGHT_PANEL x=1005–1279, y=0–719; 00:00:26.50–END RIGHT_PANEL RIGHT_PANEL x=1080–1279, y=0–719
- **W05-P01** `LMC_WEEK05_P01_stress-definition-and-core-characteristics.mp4` → 00:01:23.50–END RIGHT_PANEL RIGHT_PANEL x=1027–1211, y=0–719
- **W05-P06** `LMC_WEEK05_P06_stress-case-application-01.mp4` → NO MASK
- **W05-P07** `LMC_WEEK05_P07_stress-case-application-02.mp4` → NO MASK
- **W05-P08** `LMC_WEEK05_P08_case-integration-and-result-review.mp4` → 00:12:10.16–END RIGHT_PANEL RIGHT_PANEL x=1008–1211, y=0–719
- **W08-P01** `LMC_WEEK08_P01_happiness-depression-assessment-and-classification.mp4` → 00:01:33.00–END RIGHT_PANEL RIGHT_PANEL x=1132–1279, y=0–719
- **W08-P05** `LMC_WEEK08_P05_symptoms-assessment-treatment-and-results.mp4` → 00:00:00.00–00:05:00.32 RIGHT_PANEL RIGHT_PANEL x=1132–1279, y=0–719; 00:06:19.82–00:06:25.32 FULL_FRAME FULL_FRAME x=0–1279, y=0–719; 00:06:25.32–END RIGHT_PANEL RIGHT_PANEL x=1083–1279, y=0–719
- **W09-P01** `LMC_WEEK09_P01_abnormal-psychology-and-boundaries.mp4` → 00:00:00.00–00:00:47.50 FULL_FRAME FULL_FRAME x=0–1279, y=0–719; 00:00:47.50–END RIGHT_PANEL RIGHT_PANEL x=1189–1279, y=0–719
- **W09-P04** `LMC_WEEK09_P04_theoretical-and-treatment-approaches.mp4` → 00:00:00.00–00:12:08.75 RIGHT_PANEL RIGHT_PANEL x=1189–1279, y=0–719; 00:12:08.75–00:13:08.75 FULL_FRAME FULL_FRAME x=0–1279, y=0–719; 00:13:08.75–END RIGHT_PANEL RIGHT_PANEL x=1152–1279, y=0–719

## 합계

- 총 파일: **77**
- MASK 파일: **75**
- NO MASK 파일: **2**
