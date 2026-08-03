import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COURSE_ID = 'lmc-lifetime-management-counselor';
const pad = (value) => String(value).padStart(2, '0');
const seconds = (minutes, remain = 0) => (minutes * 60) + remain;

const weeks = [
  {
    week: 1,
    title: '나와 타인 그리고 세상을 보는 눈',
    theory: '자기개념과 타인지각을 이해하고 상담코칭 장면에서 관계를 바라보는 기초 관점을 형성합니다.',
    practice: '자기이해·타인지각 사례를 통해 핵심 개념을 실제 장면과 연결합니다.',
    recommendedFor: '상담사와 코치를 위한 인간이해 기초',
    parts: [
      ['자기의 개념·종류·원천', seconds(20, 20), 'self-concept-and-sources'],
      ['자기동기와 자아존중감', seconds(14), 'motivation-and-self-esteem'],
      ['자기방어·자기수용·자기개방', seconds(21, 30), 'self-defense-acceptance-disclosure'],
      ['타인에 대한 인상형성', seconds(26, 10), 'impression-formation'],
      ['매력의 요인: 유사성과 보상성', seconds(23, 54), 'similarity-and-complementarity']
    ]
  },
  {
    week: 2,
    title: '적성의 다요인 종합분석기법을 활용한 진로적성검사',
    theory: '적성의 구성요인과 종합분석 원리를 이해하고 검사결과를 진로 맥락과 연결합니다.',
    practice: '종합적성 결과보고서와 CIPP 플랫폼을 활용해 해석 절차를 연습합니다.',
    recommendedFor: '진로·적성검사를 활용하는 상담사·교사·코치',
    parts: [
      ['적성의 구성과 다요인 분석 개요', seconds(23, 51), 'aptitude-structure-and-multifactor-analysis'],
      ['적성판단의 어려움과 개별검사 종합분석', seconds(19, 45), 'difficulties-and-integrated-test-analysis'],
      ['종합적성분석법과 성격 유형 이론', seconds(17, 21), 'comprehensive-aptitude-and-personality-theories'],
      ['RS 다중지능·직업가치관검사와 CIPP 플랫폼', seconds(23, 16), 'rs-tests-and-cipp-platform'],
      ['종합검사 결과보고서 해석 실습', seconds(20, 31), 'result-report-interpretation-practice'],
      ['회원관리·결과조회·데이터 활용', seconds(11, 22), 'member-management-and-data-use'],
      ['AI를 활용한 진로·적성 해석과 정리', seconds(16, 37), 'ai-assisted-career-interpretation']
    ]
  },
  {
    week: 3,
    title: '성격 이해와 16PF 검사 해석',
    theory: '성격이론의 주요 흐름과 Cattell 특질론을 바탕으로 16PF의 구조를 이해합니다.',
    practice: '16PF 결과보고서를 사례와 맥락 중심으로 읽고 AI 보조 해석의 한계를 점검합니다.',
    recommendedFor: '성격과 성격검사에 관심 있는 상담사·코치',
    parts: [
      ['과정 안내와 성격의 정의', seconds(18, 37), 'course-introduction-and-personality-definition'],
      ['성격의 특성과 이해의 필요성', seconds(15, 5), 'personality-characteristics-and-importance'],
      ['성격이론의 두 흐름: 특성이론과 과정이론', seconds(15, 15), 'trait-and-process-theories'],
      ['성격을 조망하는 다양한 관점 ①', seconds(15, 5), 'personality-perspectives-01'],
      ['성격을 조망하는 다양한 관점 ②', seconds(15, 9), 'personality-perspectives-02'],
      ['성격이론 통합과 Cattell 특질론·16PF', seconds(18, 37), 'cattell-trait-theory-and-16pf'],
      ['16PF 결과보고서 해석 실습', seconds(12, 31), '16pf-report-interpretation-practice'],
      ['AI 보조 해석과 검사 플랫폼 활용', seconds(10, 17), 'ai-assisted-interpretation-and-platform']
    ]
  },
  {
    week: 4,
    title: '의사소통 유형의 이해와 검사 해석',
    theory: '의사소통의 구조와 기능, 유형별 반응 특성을 이해합니다.',
    practice: '10개 의사소통 유형과 결과보고서를 사례 중심으로 해석합니다.',
    recommendedFor: '의사소통과 관계에 관심 있는 상담사·코치',
    parts: [
      ['의사소통의 개념과 기본 구조', seconds(15, 37), 'communication-concept-and-structure'],
      ['의사소통의 특성·기능과 표현 요소', seconds(18, 11), 'communication-functions-and-expression'],
      ['의사소통 10유형의 구조와 진단 기준', seconds(14), 'ten-types-and-assessment-criteria'],
      ['의사소통 유형별 특성 해석', seconds(13, 29), 'type-characteristics-interpretation'],
      ['유형 적용 사례와 해석 정리', seconds(11, 16), 'case-application-and-summary'],
      ['검사 결과보고서와 플랫폼 활용', seconds(7, 8), 'report-and-platform-use']
    ]
  },
  {
    week: 5,
    title: '스트레스의 이해와 RS-스트레스 검사 활용',
    theory: '스트레스의 핵심 특성, 이론, 원인과 증상, 대처기제를 통합적으로 이해합니다.',
    practice: 'RS-스트레스 검사와 사례를 활용해 결과를 맥락 안에서 해석합니다.',
    recommendedFor: '스트레스의 심리적 기제를 알고자 하는 상담사·코치',
    parts: [
      ['스트레스의 정의와 핵심 특성', seconds(21, 19), 'stress-definition-and-core-characteristics'],
      ['긍정·부정 스트레스와 주요 스트레스 이론', seconds(14, 24), 'positive-negative-stress-and-theories'],
      ['RS-스트레스 검사: 스트레스 원인', seconds(12, 15), 'rs-stress-assessment-causes'],
      ['스트레스 증상과 생리적 반응', seconds(16, 58), 'stress-symptoms-and-physiological-response'],
      ['스트레스 대처 유형과 관리 전략', seconds(8, 36), 'coping-types-and-management-strategies'],
      ['스트레스 경험 사례 나눔과 적용 ①', seconds(15, 46), 'stress-case-application-01'],
      ['스트레스 경험 사례 나눔과 적용 ②', seconds(18, 20), 'stress-case-application-02'],
      ['사례 통합 정리와 검사 결과 확인', seconds(13, 32), 'case-integration-and-result-review']
    ]
  },
  {
    week: 6,
    title: '학습검사의 이해와 활용: 학습양식 및 학습정서',
    theory: '학습양식과 정의적 요소, 성격 및 두뇌 기능의 관계를 다각적으로 이해합니다.',
    practice: '학습양식·학습정서 결과보고서를 학습자 맥락과 연결해 해석합니다.',
    recommendedFor: '학생을 지도하는 학부모·교사·코치',
    parts: [
      ['과정 안내와 학습양식의 기본 개념', seconds(18, 39), 'course-introduction-and-learning-style'],
      ['학습양식의 다각적 정의: 인지·정의·환경', seconds(19, 28), 'cognitive-affective-environmental-learning-style'],
      ['학습 성과를 높이는 5대 정의적 요소', seconds(12, 1), 'five-affective-learning-factors'],
      ['융 분석심리학 기반 학습 성격 접근', seconds(11, 8), 'jungian-learning-personality'],
      ['학습자 유형별 학습법과 두뇌 기능 분석', seconds(14, 24), 'learner-types-and-brain-functions'],
      ['학습양식 검사 결과보고서 해석 실습', seconds(17, 57), 'learning-style-report-practice'],
      ['학습정서 결과 해석과 검사 플랫폼 활용', seconds(18, 18), 'learning-emotion-and-platform-use']
    ]
  },
  {
    week: 7,
    title: '정서검사의 이해와 활용: 정서척도 및 결과 해석',
    theory: '정서검사의 구성과 주요 정서척도를 이해하고 점수·맥락·패턴을 함께 읽습니다.',
    practice: '정서검사 사례를 상담·코칭 장면에 적용하되 진단적 단정을 피합니다.',
    recommendedFor: '정서적 곤란에 관심 있는 상담사·코치',
    safetyNotice: true,
    parts: [
      ['정서검사의 구성과 결과그래프 읽기', seconds(18, 36), 'emotion-assessment-overview-and-result-graph'],
      ['정서검사 사례 해석 ① 점수와 반응 이해', seconds(16, 27), 'case-interpretation-scores-and-responses'],
      ['정서검사 사례 해석 ② 맥락과 정서 패턴', seconds(19, 58), 'case-interpretation-context-and-patterns'],
      ['사례 통합과 상담·코칭 적용', seconds(15, 9), 'case-integration-and-coaching-application'],
      ['정서척도 ① 사회적 불안과 외로움', seconds(18, 36), 'social-anxiety-and-loneliness'],
      ['정서척도 ② 분노의 원인·기능·영향', seconds(16, 17), 'anger-causes-functions-and-effects'],
      ['정서척도 ③ 공격성·무기력·열등감과 결과보고서', seconds(16, 49), 'aggression-lethargy-inferiority-and-report']
    ]
  },
  {
    week: 8,
    title: '행복지수(우울)검사의 이해와 활용',
    theory: '우울 관련 개념과 증상척도의 구조를 교육적 범위에서 이해합니다.',
    practice: '행복지수 결과를 확정적 진단이 아닌 상담·코칭 보조자료로 해석합니다.',
    recommendedFor: '우울 관련 상담 주제에 관심 있는 상담사·코치',
    safetyNotice: true,
    parts: [
      ['행복지수(우울)검사의 이해와 우울 분류', seconds(18, 26), 'happiness-depression-assessment-and-classification'],
      ['기분곡선과 우울·조증·경조증 삽화', seconds(14, 55), 'mood-curve-and-mood-episodes'],
      ['주요우울장애 진단기준과 특성', seconds(9, 30), 'major-depression-criteria-and-characteristics'],
      ['우울의 생물학적·심리사회적 원인', seconds(15, 31), 'biological-and-psychosocial-causes'],
      ['우울 증상·검사·치료와 결과구조', seconds(9, 51), 'symptoms-assessment-treatment-and-results'],
      ['행복지수 6개 증상척도의 구성과 해석', seconds(16, 48), 'six-symptom-scales-and-interpretation'],
      ['증상척도 사례 적용과 종합 해석', seconds(15, 45), 'symptom-scale-case-application'],
      ['결과보고서와 검사 플랫폼 활용', seconds(5, 6), 'report-and-assessment-platform']
    ]
  },
  {
    week: 9,
    title: '심리건강(이상심리)검사의 이해와 활용',
    theory: '정상과 이상의 경계, 진단체계와 이론적 관점을 교육적 범위에서 이해합니다.',
    practice: 'RS 심리건강 척도를 사례와 맥락 안에서 해석하고 전문기관 연계의 경계를 확인합니다.',
    recommendedFor: '심리건강에 관심 있는 상담사·코치',
    safetyNotice: true,
    parts: [
      ['이상심리학의 이해와 정상·이상의 경계', seconds(18), 'abnormal-psychology-and-boundaries'],
      ['이상심리 판단기준: 현실판단·적응·통계', seconds(18), 'judgment-criteria-reality-adaptation-statistics'],
      ['사회문화적 기준과 ICD·DSM 진단체계', seconds(13, 53), 'sociocultural-criteria-and-icd-dsm'],
      ['이상심리의 이론적 입장과 치료 접근', seconds(13, 39), 'theoretical-and-treatment-approaches'],
      ['RS 심리건강 7개 척도 해석 ① 핵심 개념', seconds(20, 4), 'seven-scales-core-concepts'],
      ['RS 심리건강 7개 척도 해석 ② 원인과 영향', seconds(19, 58), 'seven-scales-causes-and-effects'],
      ['RS 심리건강 7개 척도 해석 ③ 사례 통합과 활용', seconds(21, 23), 'seven-scales-case-integration']
    ]
  },
  {
    week: 10,
    title: '부부커플검사의 이해와 활용: 결혼만족도 및 결과 해석',
    theory: '결혼만족도와 관계 자원·조정 과제를 결과프로파일과 함께 이해합니다.',
    practice: '13개 측정요인을 사례에 적용해 관계 맥락 중심으로 통합 해석합니다.',
    recommendedFor: '결혼심리학과 관계상담에 관심 있는 상담사·코치',
    parts: [
      ['RS 부부커플검사 결과프로파일 읽기', seconds(18, 32), 'couple-assessment-profile'],
      ['사례 해석 ① 높은 요인과 관계 자원', seconds(18, 7), 'case-strengths-and-relationship-resources'],
      ['사례 해석 ② 낮은 요인과 조정 과제', seconds(18, 40), 'case-low-factors-and-adjustment'],
      ['사례 통합과 부부상담·코칭 적용', seconds(19, 19), 'case-integration-and-couple-coaching'],
      ['부부커플검사 개요와 결혼만족도 이론', seconds(11, 47), 'assessment-overview-and-marital-satisfaction'],
      ['13개 측정요인의 의미와 해석기준', seconds(13, 5), 'thirteen-factors-and-criteria'],
      ['결과보고서 해석과 검사 플랫폼 활용', seconds(15, 37), 'report-interpretation-and-platform']
    ]
  },
  {
    week: 11,
    title: '발달진단검사의 이해와 활용: 아동·청소년 및 성인',
    theory: '아동·청소년과 성인의 생애단계별 발달요인과 검사 구조를 이해합니다.',
    practice: '사례와 결과보고서를 활용해 발달요인을 비교하고 통합적으로 해석합니다.',
    recommendedFor: '발달의 심리적 개념에 관심 있는 상담사·코치',
    parts: [
      ['발달검사 결과프로파일과 측정요인 개요', seconds(17), 'development-profile-and-factors'],
      ['아동·청소년 발달요인 ① 신체·자아상·자기조절', seconds(16, 55), 'youth-physical-self-image-self-regulation'],
      ['아동·청소년 발달요인 ② 학업·효능감·정체성·독립성', seconds(14, 9), 'youth-academic-efficacy-identity-independence'],
      ['성인 발달요인과 발달진단검사 전체 구조', seconds(13, 34), 'adult-development-and-assessment-structure'],
      ['발달진단검사 구성과 아동·청소년 사례 적용', seconds(14, 21), 'assessment-structure-and-youth-case'],
      ['생애단계별 발달요인 비교와 통합 해석', seconds(13, 46), 'lifespan-comparison-and-integration'],
      ['성인 발달요인·결과보고서와 과정 정리', seconds(14, 57), 'adult-factors-report-and-summary']
    ]
  }
].map((week) => ({
  ...week,
  id: `week-${pad(week.week)}`,
  parts: week.parts.map(([title, durationSeconds, slug], index) => {
    const part = index + 1;
    return {
      part,
      id: `week-${pad(week.week)}-part-${pad(part)}`,
      title,
      durationSeconds,
      mediaId: `lmc-w${pad(week.week)}-p${pad(part)}`,
      sourceFilename: `LMC_WEEK${pad(week.week)}_P${pad(part)}_${slug}.mp4`,
      status: 'pending_upload'
    };
  })
}));

for (const week of weeks) {
  week.videoSeconds = week.parts.reduce((sum, part) => sum + part.durationSeconds, 0);
  week.videoMinutes = Math.round(week.videoSeconds / 60);
}

const totalVideoSeconds = weeks.reduce((sum, week) => sum + week.videoSeconds, 0);
const totalParts = weeks.reduce((sum, week) => sum + week.parts.length, 0);
if (totalParts !== 77) throw new Error(`Expected 77 parts, got ${totalParts}`);

const coursePath = path.join(ROOT, 'lcms/academy/data/courses.json');
const existing = JSON.parse(await fs.readFile(coursePath, 'utf8'));
const previous = existing.courses.find((course) => course.id === COURSE_ID);
if (!previous) throw new Error(`Course not found: ${COURSE_ID}`);

const completionWeek = {
  week: 12,
  id: 'week-12',
  title: '수료시험 및 과정 통합',
  theory: '1~11주 핵심내용을 통합하고 상담코칭 현장에서의 전문활용 기준을 정리합니다.',
  practice: '수료시험·전체 성찰·만족도 조사·학기말 수료식·수료 및 자격증 발급 절차를 진행합니다.',
  recommendedFor: '자격증 발급 대상 심사',
  videoSeconds: 0,
  videoMinutes: 0,
  parts: []
};

const nextCourse = {
  ...previous,
  estimatedLessons: 77,
  estimatedMinutes: 1440,
  videoDurationSeconds: totalVideoSeconds,
  videoPartCount: totalParts,
  scheduleSummary: '12주 · 공식 교육과정 총 24시간',
  releasePolicy: { mode: 'all_open', scheduledDates: {} },
  weeks: [...weeks, completionWeek]
};
delete nextCourse.modules;

const courses = {
  ...existing,
  version: '0.3.0',
  updatedAt: '2026-08-03',
  courses: existing.courses.map((course) => course.id === COURSE_ID ? nextCourse : course)
};

const media = weeks.flatMap((week) => week.parts.map((part) => ({
  mediaId: part.mediaId,
  courseId: COURSE_ID,
  week: week.week,
  part: part.part,
  partId: part.id,
  title: part.title,
  durationSeconds: part.durationSeconds,
  provider: 'R2',
  objectKey: `lmc/v2/week-${pad(week.week)}/part-${pad(part.part)}.mp4`,
  sourceFilename: part.sourceFilename,
  accessPolicy: 'PRIVATE_WORKER_SIGNED_URL',
  status: 'pending_upload',
  sha256: null,
  sizeBytes: null,
  publishedAt: null,
  captions: []
})));

const mediaCatalog = {
  version: '4.0.0',
  updatedAt: '2026-08-03',
  source: 'Cloudflare R2 private bucket via authenticated Worker gateway',
  policy: {
    r2: 'Paid course videos stay in a private R2 bucket and are served only through short-lived Worker playback URLs after LMC session validation.',
    secrets: 'Do not store Cloudflare API tokens, R2 credentials, Worker secrets, signed URLs, or direct object URLs in this public catalog.'
  },
  courses: {
    [COURSE_ID]: {
      videoWeeks: 11,
      videoParts: totalParts,
      videoDurationSeconds: totalVideoSeconds,
      completionWeek: 12,
      completionType: '수료시험·과정 통합·학기말 수료식',
      media
    }
  }
};

const uploadMap = media.map((item) => ({
  week: item.week,
  part: item.part,
  mediaId: item.mediaId,
  title: item.title,
  localFilename: item.sourceFilename,
  objectKey: item.objectKey,
  durationSeconds: item.durationSeconds,
  sizeBytes: item.sizeBytes,
  sha256: item.sha256,
  status: item.status
}));

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csvFields = ['week', 'part', 'mediaId', 'title', 'localFilename', 'objectKey', 'durationSeconds', 'sizeBytes', 'sha256', 'status'];
const csv = [csvFields.join(','), ...uploadMap.map((row) => csvFields.map((field) => csvEscape(row[field])).join(','))].join('\n') + '\n';

const uploadCommands = `#!/usr/bin/env bash
set -euo pipefail

# Generated upload commands only. Review preflight results before executing.
# Required runtime values are intentionally not stored in this repository.
# Examples:
#   export LMC_R2_BUCKET='rsedu-lmc-videos'
#   export LMC_VIDEO_DIR='/absolute/path/to/verified/videos'

: "\${LMC_R2_BUCKET:?Set LMC_R2_BUCKET}"
: "\${LMC_VIDEO_DIR:?Set LMC_VIDEO_DIR}"

${uploadMap.map((item) => `npx wrangler r2 object put "\${LMC_R2_BUCKET}/${item.objectKey}" --file "\${LMC_VIDEO_DIR}/${item.localFilename}" --content-type video/mp4`).join('\n')}

# rclone alternative (configure the remote outside this repository):
${uploadMap.map((item) => `# rclone copyto "\${LMC_VIDEO_DIR}/${item.localFilename}" "r2:\${LMC_R2_BUCKET}/${item.objectKey}" --s3-no-check-bucket`).join('\n')}
`;

await fs.mkdir(path.join(ROOT, 'lcms/academy/r2-worker/upload'), { recursive: true });
const workerCatalog = `// Generated from lcms/academy/data/media-catalog.json.\n// Regenerate only while preparing the catalog; published status changes require review.\nexport const MEDIA_CATALOG = new Map(${JSON.stringify(media, null, 2)}.map((item) => [\`\${item.week}:\${item.part}\`, item]));\n`;
await Promise.all([
  fs.writeFile(coursePath, JSON.stringify(courses, null, 2) + '\n'),
  fs.writeFile(path.join(ROOT, 'lcms/academy/data/media-catalog.json'), JSON.stringify(mediaCatalog, null, 2) + '\n'),
  fs.writeFile(path.join(ROOT, 'lcms/academy/r2-worker/upload/video-upload-map.json'), JSON.stringify(uploadMap, null, 2) + '\n'),
  fs.writeFile(path.join(ROOT, 'lcms/academy/r2-worker/upload/video-upload-map.csv'), csv),
  fs.writeFile(path.join(ROOT, 'lcms/academy/r2-worker/upload/upload-commands.sh'), uploadCommands),
  fs.writeFile(path.join(ROOT, 'lcms/academy/r2-worker/src/media-catalog.js'), workerCatalog)
]);

console.log(JSON.stringify({ weeks: weeks.length + 1, videoWeeks: weeks.length, parts: totalParts, totalVideoSeconds }, null, 2));
