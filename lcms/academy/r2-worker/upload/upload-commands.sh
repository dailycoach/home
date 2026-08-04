#!/usr/bin/env bash
set -euo pipefail

# Generated upload commands only. Review preflight results before executing.
# These destinations match the manually uploaded R2 object inventory.
# Running these commands will overwrite objects that already use the same keys.
# Required runtime values are intentionally not stored in this repository.
# Examples:
#   export LMC_R2_BUCKET='rsedu-lmc-videos'
#   export LMC_VIDEO_DIR='/absolute/path/to/verified/videos'

: "${LMC_R2_BUCKET:?Set LMC_R2_BUCKET}"
: "${LMC_VIDEO_DIR:?Set LMC_VIDEO_DIR}"

npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-01/LMC_WEEK01_P01_self-concept-and-sources.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK01_P01_self-concept-and-sources.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-01/LMC_WEEK01_P02_motivation-and-self-esteem.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK01_P02_motivation-and-self-esteem.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-01/LMC_WEEK01_P03_self-defense-acceptance-disclosure.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK01_P03_self-defense-acceptance-disclosure.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-01/LMC_WEEK01_P04_impression-formation.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK01_P04_impression-formation.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-01/LMC_WEEK01_P05_similarity-and-complementarity.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK01_P05_similarity-and-complementarity.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P01_aptitude-structure-and-multifactor-analysis.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P01_aptitude-structure-and-multifactor-analysis.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P02_difficulties-and-integrated-test-analysis.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P02_difficulties-and-integrated-test-analysis.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P03_comprehensive-aptitude-and-personality-theories.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P03_comprehensive-aptitude-and-personality-theories.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P04_rs-tests-and-cipp-platform.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P04_rs-tests-and-cipp-platform.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P05_result-report-interpretation-practice.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P05_result-report-interpretation-practice.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P06_member-management-and-data-use.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P06_member-management-and-data-use.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P07_ai-assisted-career-interpretation.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK02_P07_ai-assisted-career-interpretation.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P01_course-overview-and-personality-definition.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P01_course-introduction-and-personality-definition.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P02_personality-characteristics-and-importance.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P02_personality-characteristics-and-importance.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P03_personality-theory-framework-one.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P03_trait-and-process-theories.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P04_personality-theory-framework-two.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P04_personality-perspectives-01.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P05_personality-theory-comparison-and-application.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P05_personality-perspectives-02.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P06_integrated-theories-cattell-and-16pf.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P06_cattell-trait-theory-and-16pf.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P07_16pf-report-interpretation-practice.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P07_16pf-report-interpretation-practice.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P08_ai-assisted-interpretation-and-platform-use.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK03_P08_ai-assisted-interpretation-and-platform.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P01_communication-concept-and-structure.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P01_communication-concept-and-structure.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P02_characteristics-functions-and-expression.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P02_communication-functions-and-expression.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P03_ten-styles-framework-and-criteria.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P03_ten-types-and-assessment-criteria.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P04_style-characteristics-and-interpretation.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P04_type-characteristics-interpretation.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P05_case-application-and-interpretation-review.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P05_case-application-and-summary.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P06_report-and-platform-use.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK04_P06_report-and-platform-use.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P01_stress-definition-and-characteristics(1).mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P01_stress-definition-and-core-characteristics.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P02_stress-theories-and-cognitive-appraisal(1).mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P02_positive-negative-stress-and-theories.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P03_stress-causes-and-assessment(1).mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P03_rs-stress-assessment-causes.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P04_stress-symptoms-and-physiological-response(1).mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P04_stress-symptoms-and-physiological-response.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P05_coping-styles-and-management-strategies(1).mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P05_coping-types-and-management-strategies.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P06_case-sharing-and-application-one(1).mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P06_stress-case-application-01.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P07_case-sharing-and-application-two(1).mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P07_stress-case-application-02.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P08_integration-and-result-review(1).mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK05_P08_case-integration-and-result-review.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P01_course-overview-and-learning-style-basics.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P01_course-introduction-and-learning-style.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P02_multidimensional-learning-style-definition.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P02_cognitive-affective-environmental-learning-style.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P03_five-affective-factors-for-learning.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P03_five-affective-learning-factors.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P04_jungian-psychology-and-learning-personality.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P04_jungian-learning-personality.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P05_learner-types-and-brain-function.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P05_learner-types-and-brain-functions.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P06_learning-style-report-interpretation.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P06_learning-style-report-practice.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P07_learning-emotion-results-and-platform.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK06_P07_learning-emotion-and-platform-use.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P01_emotion-assessment-overview-and-result-graph.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P01_emotion-assessment-overview-and-result-graph.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P02_case-interpretation-scores-and-responses.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P02_case-interpretation-scores-and-responses.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P03_case-interpretation-context-and-patterns.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P03_case-interpretation-context-and-patterns.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P04_case-integration-and-coaching-application.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P04_case-integration-and-coaching-application.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P05_social-anxiety-and-loneliness.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P05_social-anxiety-and-loneliness.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P06_anger-causes-functions-and-impact.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P06_anger-causes-functions-and-effects.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P07_aggression-lethargy-inferiority-and-report.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK07_P07_aggression-lethargy-inferiority-and-report.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P01_depression-assessment-and-classification.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P01_happiness-depression-assessment-and-classification.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P02_mood-curve-and-depressive-manic-episodes.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P02_mood-curve-and-mood-episodes.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P03_major-depression-diagnostic-criteria.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P03_major-depression-criteria-and-characteristics.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P04_biological-and-psychosocial-causes.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P04_biological-and-psychosocial-causes.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P05_symptoms-treatment-and-result-structure.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P05_symptoms-assessment-treatment-and-results.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P06_six-symptom-scales-overview.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P06_six-symptom-scales-and-interpretation.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P07_scale-cases-and-integrated-interpretation.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P07_symptom-scale-case-application.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P08_result-report-and-platform-use.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK08_P08_report-and-assessment-platform.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P01_abnormal-psychology-and-boundaries.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P01_abnormal-psychology-and-boundaries.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P02_judgment-criteria-reality-adaptation-statistics.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P02_judgment-criteria-reality-adaptation-statistics.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P03_sociocultural-criteria-and-icd-dsm.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P03_sociocultural-criteria-and-icd-dsm.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P04_theoretical-and-treatment-approaches.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P04_theoretical-and-treatment-approaches.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P05_seven-scales-core-concepts.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P05_seven-scales-core-concepts.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P06_seven-scales-causes-and-effects.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P06_seven-scales-causes-and-effects.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P07_seven-scales-case-integration.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK09_P07_seven-scales-case-integration.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P01_report-profile-overview.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P01_couple-assessment-profile.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P02_case-interpretation-strength-factors.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P02_case-strengths-and-relationship-resources.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P03_case-interpretation-adjustment-factors.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P03_case-low-factors-and-adjustment.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P04_case-integration-and-couple-coaching.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P04_case-integration-and-couple-coaching.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P05_assessment-overview-and-marital-satisfaction.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P05_assessment-overview-and-marital-satisfaction.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P06_thirteen-factors-and-interpretation.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P06_thirteen-factors-and-criteria.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P07_result-report-and-platform-use.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK10_P07_report-interpretation-and-platform.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P01_result-profile-and-factor-overview.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P01_development-profile-and-factors.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P02_child-adolescent-factors-self-and-regulation.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P02_youth-physical-self-image-self-regulation.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P03_child-adolescent-factors-learning-identity-independence.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P03_youth-academic-efficacy-identity-independence.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P04_adult-factors-and-assessment-framework.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P04_adult-development-and-assessment-structure.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P05_child-adolescent-case-application.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P05_assessment-structure-and-youth-case.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P06_child-review-and-adult-factor-transition.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P06_lifespan-comparison-and-integration.mp4" --content-type video/mp4
npx wrangler r2 object put "${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P07_adult-factors-report-and-course-summary.mp4" --file "${LMC_VIDEO_DIR}/LMC_WEEK11_P07_adult-factors-report-and-summary.mp4" --content-type video/mp4

# rclone alternative (configure the remote outside this repository):
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK01_P01_self-concept-and-sources.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-01/LMC_WEEK01_P01_self-concept-and-sources.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK01_P02_motivation-and-self-esteem.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-01/LMC_WEEK01_P02_motivation-and-self-esteem.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK01_P03_self-defense-acceptance-disclosure.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-01/LMC_WEEK01_P03_self-defense-acceptance-disclosure.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK01_P04_impression-formation.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-01/LMC_WEEK01_P04_impression-formation.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK01_P05_similarity-and-complementarity.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-01/LMC_WEEK01_P05_similarity-and-complementarity.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P01_aptitude-structure-and-multifactor-analysis.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P01_aptitude-structure-and-multifactor-analysis.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P02_difficulties-and-integrated-test-analysis.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P02_difficulties-and-integrated-test-analysis.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P03_comprehensive-aptitude-and-personality-theories.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P03_comprehensive-aptitude-and-personality-theories.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P04_rs-tests-and-cipp-platform.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P04_rs-tests-and-cipp-platform.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P05_result-report-interpretation-practice.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P05_result-report-interpretation-practice.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P06_member-management-and-data-use.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P06_member-management-and-data-use.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK02_P07_ai-assisted-career-interpretation.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-02/LMC_WEEK02_P07_ai-assisted-career-interpretation.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P01_course-introduction-and-personality-definition.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P01_course-overview-and-personality-definition.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P02_personality-characteristics-and-importance.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P02_personality-characteristics-and-importance.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P03_trait-and-process-theories.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P03_personality-theory-framework-one.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P04_personality-perspectives-01.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P04_personality-theory-framework-two.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P05_personality-perspectives-02.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P05_personality-theory-comparison-and-application.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P06_cattell-trait-theory-and-16pf.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P06_integrated-theories-cattell-and-16pf.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P07_16pf-report-interpretation-practice.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P07_16pf-report-interpretation-practice.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK03_P08_ai-assisted-interpretation-and-platform.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-03/LMC_WEEK03_P08_ai-assisted-interpretation-and-platform-use.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P01_communication-concept-and-structure.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P01_communication-concept-and-structure.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P02_communication-functions-and-expression.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P02_characteristics-functions-and-expression.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P03_ten-types-and-assessment-criteria.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P03_ten-styles-framework-and-criteria.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P04_type-characteristics-interpretation.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P04_style-characteristics-and-interpretation.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P05_case-application-and-summary.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P05_case-application-and-interpretation-review.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK04_P06_report-and-platform-use.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-04/LMC_WEEK04_P06_report-and-platform-use.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P01_stress-definition-and-core-characteristics.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P01_stress-definition-and-characteristics(1).mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P02_positive-negative-stress-and-theories.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P02_stress-theories-and-cognitive-appraisal(1).mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P03_rs-stress-assessment-causes.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P03_stress-causes-and-assessment(1).mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P04_stress-symptoms-and-physiological-response.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P04_stress-symptoms-and-physiological-response(1).mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P05_coping-types-and-management-strategies.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P05_coping-styles-and-management-strategies(1).mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P06_stress-case-application-01.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P06_case-sharing-and-application-one(1).mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P07_stress-case-application-02.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P07_case-sharing-and-application-two(1).mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK05_P08_case-integration-and-result-review.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-05/LMC_WEEK05_P08_integration-and-result-review(1).mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P01_course-introduction-and-learning-style.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P01_course-overview-and-learning-style-basics.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P02_cognitive-affective-environmental-learning-style.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P02_multidimensional-learning-style-definition.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P03_five-affective-learning-factors.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P03_five-affective-factors-for-learning.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P04_jungian-learning-personality.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P04_jungian-psychology-and-learning-personality.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P05_learner-types-and-brain-functions.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P05_learner-types-and-brain-function.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P06_learning-style-report-practice.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P06_learning-style-report-interpretation.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK06_P07_learning-emotion-and-platform-use.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-06/LMC_WEEK06_P07_learning-emotion-results-and-platform.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P01_emotion-assessment-overview-and-result-graph.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P01_emotion-assessment-overview-and-result-graph.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P02_case-interpretation-scores-and-responses.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P02_case-interpretation-scores-and-responses.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P03_case-interpretation-context-and-patterns.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P03_case-interpretation-context-and-patterns.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P04_case-integration-and-coaching-application.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P04_case-integration-and-coaching-application.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P05_social-anxiety-and-loneliness.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P05_social-anxiety-and-loneliness.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P06_anger-causes-functions-and-effects.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P06_anger-causes-functions-and-impact.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK07_P07_aggression-lethargy-inferiority-and-report.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-07/LMC_WEEK07_P07_aggression-lethargy-inferiority-and-report.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P01_happiness-depression-assessment-and-classification.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P01_depression-assessment-and-classification.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P02_mood-curve-and-mood-episodes.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P02_mood-curve-and-depressive-manic-episodes.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P03_major-depression-criteria-and-characteristics.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P03_major-depression-diagnostic-criteria.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P04_biological-and-psychosocial-causes.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P04_biological-and-psychosocial-causes.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P05_symptoms-assessment-treatment-and-results.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P05_symptoms-treatment-and-result-structure.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P06_six-symptom-scales-and-interpretation.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P06_six-symptom-scales-overview.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P07_symptom-scale-case-application.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P07_scale-cases-and-integrated-interpretation.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK08_P08_report-and-assessment-platform.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-08/LMC_WEEK08_P08_result-report-and-platform-use.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P01_abnormal-psychology-and-boundaries.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P01_abnormal-psychology-and-boundaries.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P02_judgment-criteria-reality-adaptation-statistics.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P02_judgment-criteria-reality-adaptation-statistics.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P03_sociocultural-criteria-and-icd-dsm.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P03_sociocultural-criteria-and-icd-dsm.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P04_theoretical-and-treatment-approaches.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P04_theoretical-and-treatment-approaches.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P05_seven-scales-core-concepts.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P05_seven-scales-core-concepts.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P06_seven-scales-causes-and-effects.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P06_seven-scales-causes-and-effects.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK09_P07_seven-scales-case-integration.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-09/LMC_WEEK09_P07_seven-scales-case-integration.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P01_couple-assessment-profile.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P01_report-profile-overview.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P02_case-strengths-and-relationship-resources.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P02_case-interpretation-strength-factors.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P03_case-low-factors-and-adjustment.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P03_case-interpretation-adjustment-factors.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P04_case-integration-and-couple-coaching.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P04_case-integration-and-couple-coaching.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P05_assessment-overview-and-marital-satisfaction.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P05_assessment-overview-and-marital-satisfaction.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P06_thirteen-factors-and-criteria.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P06_thirteen-factors-and-interpretation.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK10_P07_report-interpretation-and-platform.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-10/LMC_WEEK10_P07_result-report-and-platform-use.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P01_development-profile-and-factors.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P01_result-profile-and-factor-overview.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P02_youth-physical-self-image-self-regulation.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P02_child-adolescent-factors-self-and-regulation.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P03_youth-academic-efficacy-identity-independence.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P03_child-adolescent-factors-learning-identity-independence.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P04_adult-development-and-assessment-structure.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P04_adult-factors-and-assessment-framework.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P05_assessment-structure-and-youth-case.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P05_child-adolescent-case-application.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P06_lifespan-comparison-and-integration.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P06_child-review-and-adult-factor-transition.mp4" --s3-no-check-bucket
# rclone copyto "${LMC_VIDEO_DIR}/LMC_WEEK11_P07_adult-factors-report-and-summary.mp4" "r2:${LMC_R2_BUCKET}/lmc/v2/week-11/LMC_WEEK11_P07_adult-factors-report-and-course-summary.mp4" --s3-no-check-bucket
