#!/usr/bin/env bash
set -euo pipefail

# Generated upload commands only. Review preflight results before executing.
# Required runtime values are intentionally not stored in this repository.
# Examples:
#   export LMC_R2_BUCKET='rsedu-lmc-videos'
#   export LMC_VIDEO_DIR='/absolute/path/to/verified/videos'

: "${LMC_R2_BUCKET:?Set LMC_R2_BUCKET}"
: "${LMC_VIDEO_DIR:?Set LMC_VIDEO_DIR}"

npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-01/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK01_P01_self-concept-and-sources.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-01/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK01_P02_motivation-and-self-esteem.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-01/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK01_P03_self-defense-acceptance-disclosure.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-01/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK01_P04_impression-formation.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-01/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK01_P05_similarity-and-complementarity.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P01_aptitude-structure-and-multifactor-analysis.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P02_difficulties-and-integrated-test-analysis.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P03_comprehensive-aptitude-and-personality-theories.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P04_rs-tests-and-cipp-platform.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P05_result-report-interpretation-practice.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/part-06.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P06_member-management-and-data-use.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/part-07.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P07_ai-assisted-career-interpretation.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P01_course-introduction-and-personality-definition.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P02_personality-characteristics-and-importance.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P03_trait-and-process-theories.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P04_personality-perspectives-01.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P05_personality-perspectives-02.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/part-06.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P06_cattell-trait-theory-and-16pf.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/part-07.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P07_16pf-report-interpretation-practice.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/part-08.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P08_ai-assisted-interpretation-and-platform.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P01_communication-concept-and-structure.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P02_communication-functions-and-expression.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P03_ten-types-and-assessment-criteria.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P04_type-characteristics-interpretation.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P05_case-application-and-summary.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/part-06.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P06_report-and-platform-use.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P01_stress-definition-and-core-characteristics.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P02_positive-negative-stress-and-theories.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P03_rs-stress-assessment-causes.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P04_stress-symptoms-and-physiological-response.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P05_coping-types-and-management-strategies.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/part-06.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P06_stress-case-application-01.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/part-07.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P07_stress-case-application-02.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/part-08.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P08_case-integration-and-result-review.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P01_course-introduction-and-learning-style.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P02_cognitive-affective-environmental-learning-style.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P03_five-affective-learning-factors.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P04_jungian-learning-personality.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P05_learner-types-and-brain-functions.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/part-06.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P06_learning-style-report-practice.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/part-07.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P07_learning-emotion-and-platform-use.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P01_emotion-assessment-overview-and-result-graph.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P02_case-interpretation-scores-and-responses.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P03_case-interpretation-context-and-patterns.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P04_case-integration-and-coaching-application.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P05_social-anxiety-and-loneliness.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/part-06.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P06_anger-causes-functions-and-effects.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/part-07.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P07_aggression-lethargy-inferiority-and-report.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P01_happiness-depression-assessment-and-classification.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P02_mood-curve-and-mood-episodes.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P03_major-depression-criteria-and-characteristics.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P04_biological-and-psychosocial-causes.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P05_symptoms-assessment-treatment-and-results.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/part-06.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P06_six-symptom-scales-and-interpretation.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/part-07.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P07_symptom-scale-case-application.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/part-08.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P08_report-and-assessment-platform.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P01_abnormal-psychology-and-boundaries.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P02_judgment-criteria-reality-adaptation-statistics.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P03_sociocultural-criteria-and-icd-dsm.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P04_theoretical-and-treatment-approaches.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P05_seven-scales-core-concepts.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/part-06.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P06_seven-scales-causes-and-effects.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/part-07.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P07_seven-scales-case-integration.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P01_couple-assessment-profile.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P02_case-strengths-and-relationship-resources.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P03_case-low-factors-and-adjustment.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P04_case-integration-and-couple-coaching.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P05_assessment-overview-and-marital-satisfaction.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/part-06.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P06_thirteen-factors-and-criteria.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/part-07.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P07_report-interpretation-and-platform.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/part-01.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P01_development-profile-and-factors.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/part-02.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P02_youth-physical-self-image-self-regulation.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/part-03.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P03_youth-academic-efficacy-identity-independence.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/part-04.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P04_adult-development-and-assessment-structure.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/part-05.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P05_assessment-structure-and-youth-case.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/part-06.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P06_lifespan-comparison-and-integration.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/part-07.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P07_adult-factors-report-and-summary.mp4" --content-type video/mp4

# rclone alternative (configure the remote outside this repository):
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK01_P01_self-concept-and-sources.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-01/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK01_P02_motivation-and-self-esteem.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-01/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK01_P03_self-defense-acceptance-disclosure.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-01/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK01_P04_impression-formation.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-01/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK01_P05_similarity-and-complementarity.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-01/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P01_aptitude-structure-and-multifactor-analysis.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P02_difficulties-and-integrated-test-analysis.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P03_comprehensive-aptitude-and-personality-theories.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P04_rs-tests-and-cipp-platform.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P05_result-report-interpretation-practice.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P06_member-management-and-data-use.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/part-06.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P07_ai-assisted-career-interpretation.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/part-07.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P01_course-introduction-and-personality-definition.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P02_personality-characteristics-and-importance.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P03_trait-and-process-theories.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P04_personality-perspectives-01.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P05_personality-perspectives-02.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P06_cattell-trait-theory-and-16pf.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/part-06.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P07_16pf-report-interpretation-practice.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/part-07.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P08_ai-assisted-interpretation-and-platform.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/part-08.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P01_communication-concept-and-structure.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P02_communication-functions-and-expression.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P03_ten-types-and-assessment-criteria.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P04_type-characteristics-interpretation.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P05_case-application-and-summary.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P06_report-and-platform-use.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/part-06.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P01_stress-definition-and-core-characteristics.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P02_positive-negative-stress-and-theories.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P03_rs-stress-assessment-causes.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P04_stress-symptoms-and-physiological-response.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P05_coping-types-and-management-strategies.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P06_stress-case-application-01.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/part-06.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P07_stress-case-application-02.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/part-07.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P08_case-integration-and-result-review.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/part-08.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P01_course-introduction-and-learning-style.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P02_cognitive-affective-environmental-learning-style.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P03_five-affective-learning-factors.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P04_jungian-learning-personality.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P05_learner-types-and-brain-functions.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P06_learning-style-report-practice.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/part-06.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P07_learning-emotion-and-platform-use.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/part-07.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P01_emotion-assessment-overview-and-result-graph.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P02_case-interpretation-scores-and-responses.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P03_case-interpretation-context-and-patterns.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P04_case-integration-and-coaching-application.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P05_social-anxiety-and-loneliness.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P06_anger-causes-functions-and-effects.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/part-06.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P07_aggression-lethargy-inferiority-and-report.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/part-07.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P01_happiness-depression-assessment-and-classification.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P02_mood-curve-and-mood-episodes.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P03_major-depression-criteria-and-characteristics.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P04_biological-and-psychosocial-causes.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P05_symptoms-assessment-treatment-and-results.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P06_six-symptom-scales-and-interpretation.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/part-06.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P07_symptom-scale-case-application.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/part-07.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P08_report-and-assessment-platform.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/part-08.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P01_abnormal-psychology-and-boundaries.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P02_judgment-criteria-reality-adaptation-statistics.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P03_sociocultural-criteria-and-icd-dsm.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P04_theoretical-and-treatment-approaches.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P05_seven-scales-core-concepts.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P06_seven-scales-causes-and-effects.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/part-06.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P07_seven-scales-case-integration.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/part-07.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P01_couple-assessment-profile.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P02_case-strengths-and-relationship-resources.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P03_case-low-factors-and-adjustment.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P04_case-integration-and-couple-coaching.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P05_assessment-overview-and-marital-satisfaction.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P06_thirteen-factors-and-criteria.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/part-06.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P07_report-interpretation-and-platform.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/part-07.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P01_development-profile-and-factors.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/part-01.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P02_youth-physical-self-image-self-regulation.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/part-02.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P03_youth-academic-efficacy-identity-independence.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/part-03.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P04_adult-development-and-assessment-structure.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/part-04.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P05_assessment-structure-and-youth-case.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/part-05.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P06_lifespan-comparison-and-integration.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/part-06.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P07_adult-factors-report-and-summary.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/part-07.mp4" --s3-no-check-bucket
