#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];
const passes = [];

const requiredFiles = [
  'index.html',
  'index-source-disc.html',
  'pages.json',
  'coaching/index.html',
  'coaching/agreement/index.html',
  'coaching/agreement/sign/index.html',
  'coaching/agreement/success/index.html',
  'coaching/assets/coaching.css',
  'coaching/assets/coaching.js',
  'coaching/assets/agreement.css',
  'coaching/assets/agreement.js',
  'coaching/assets/sign-gateway.js',
  'coaching/assets/contract-templates.js',
  'coaching/assets/runtime-config.js',
  'coaching/assets/runtime-config.example.js',
  'integrations/google-apps-script/coaching-contracts/Code.gs',
  'integrations/google-apps-script/coaching-contracts/Config.gs.example',
  'integrations/google-apps-script/coaching-contracts/ConfigService.gs',
  'integrations/google-apps-script/coaching-contracts/Install.gs',
  'integrations/google-apps-script/coaching-contracts/Schema.gs',
  'integrations/google-apps-script/coaching-contracts/SecurityService.gs',
  'integrations/google-apps-script/coaching-contracts/StorageService.gs',
  'integrations/google-apps-script/coaching-contracts/StateMachine.gs',
  'integrations/google-apps-script/coaching-contracts/ValidationService.gs',
  'integrations/google-apps-script/coaching-contracts/AuditService.gs',
  'integrations/google-apps-script/coaching-contracts/ContractService.gs',
  'integrations/google-apps-script/coaching-contracts/ContractTerms.gs',
  'integrations/google-apps-script/coaching-contracts/TokenService.gs',
  'integrations/google-apps-script/coaching-contracts/OtpService.gs',
  'integrations/google-apps-script/coaching-contracts/PdfService.gs',
  'integrations/google-apps-script/coaching-contracts/MailService.gs',
  'integrations/google-apps-script/coaching-contracts/JobService.gs',
  'integrations/google-apps-script/coaching-contracts/ManagementService.gs',
  'integrations/google-apps-script/coaching-contracts/SignPage.html',
  'integrations/google-apps-script/coaching-contracts/OtpPage.html',
  'integrations/google-apps-script/coaching-contracts/CompletePage.html',
  'integrations/google-apps-script/coaching-contracts/AdminIssueDialog.html',
  'integrations/google-apps-script/coaching-contracts/EmailIssued.html',
  'integrations/google-apps-script/coaching-contracts/EmailOtp.html',
  'integrations/google-apps-script/coaching-contracts/EmailCompleted.html',
  'integrations/google-apps-script/coaching-contracts/appsscript.json',
  'integrations/google-apps-script/coaching-contracts/README.md',
  'docs/coaching-contract-legal-review.md',
  'docs/coaching-contract-operations.md',
  'docs/coaching-contract-qa-report.md'
];

function filePath(relative) {
  return path.join(root, relative);
}

function read(relative) {
  return fs.readFileSync(filePath(relative), 'utf8');
}

function record(name, ok, detail = '') {
  if (ok) {
    passes.push(name);
    return;
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function count(text, fragment) {
  return text.split(fragment).length - 1;
}

function containsAll(text, fragments) {
  return fragments.every((fragment) => text.includes(fragment));
}

function gatherFiles(directory) {
  const results = [];
  if (!fs.existsSync(directory)) return results;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...gatherFiles(target));
    else results.push(target);
  }
  return results;
}

for (const relative of requiredFiles) {
  record(`필수 파일: ${relative}`, fs.existsSync(filePath(relative)));
}

const source = read('index-source-disc.html');
const loader = read('index.html');
const templates = read('coaching/assets/contract-templates.js');
const agreementCss = read('coaching/assets/agreement.css');
const runtimeConfig = read('coaching/assets/runtime-config.js');

record('데스크톱 코칭안내 메뉴', containsAll(source, [
  '>코칭안내 <span',
  '/coaching/#definition',
  '/coaching/#types',
  '/coaching/#ethics',
  '/coaching/#process',
  'data-route="coachingAgreement"'
]));
record('전체 메뉴 코칭안내 카테고리', source.includes('data-category="coaching-guide"'));
record('기존 코칭 신청 카테고리 유지', source.includes('data-category="coaching"'));
record('메인 주요 바로가기', source.includes('코칭 이해·분야 선택·계약서 작성'));
record('코칭안내 CTA의 기존 스마트스토어 링크 유지', read('coaching/index.html').includes('스마트스토어에서 1:1 코칭 신청'));
record('푸터 코칭안내 링크 단일', count(source, 'data-route="coachingGuide">코칭안내</a>') === 1);
record('푸터 코칭계약서 링크 단일', count(source, 'data-route="coachingAgreement">코칭계약서</a>') === 1);
record('라우트 객체 코칭안내', source.includes("coachingGuide: '/coaching/'"));
record('라우트 객체 코칭계약서', source.includes("coachingAgreement: '/coaching/agreement/'"));
record('로더 기존 KGM210 anchor 유지', loader.includes('data-route="kgm210">KGM210 성장코칭'));
record('로더 기존 활동도구 anchor 유지', containsAll(loader, [
  'desktopActivityAnchor',
  'panelActivityAnchor',
  'footerActivityAnchor'
]));
record('로더 신규 메뉴 중복 주입 없음', !loader.includes('const coachingGuideLink'));
record('로더 fetch 버전 갱신', loader.includes('20260730-coaching-contracts-v1'));
record('메인 슬라이드 선택은 상태가 있는 버튼 그룹', containsAll(source, [
  'class="dots" role="group"',
  'aria-pressed="true"',
  "dot.setAttribute('aria-pressed', String(selected))"
]) && !source.includes('role="tablist"'));
record('코칭안내 모바일 메뉴 포커스 복원·순환', containsAll(
  read('coaching/assets/coaching.js'),
  [
    'if (!open && restoreFocus) menuButton.focus()',
    "event.key === 'Escape' && menuOpen",
    "event.key !== 'Tab' || !menuOpen",
    'last.focus()',
    'first.focus()'
  ]
));

let pages;
try {
  pages = JSON.parse(read('pages.json'));
  record('pages.json 유효 JSON', true);
} catch (error) {
  record('pages.json 유효 JSON', false, error.message);
  pages = [];
}

record('pages.json 코칭안내 등록', pages.some((item) => item.url === '/coaching/' && item.category === 'coaching'));
record('pages.json 코칭계약서 등록', pages.some((item) => item.url === '/coaching/agreement/' && item.category === 'coaching'));

record('계약 유형 3종', containsAll(templates, [
  "code: 'life'",
  "code: 'business'",
  "code: 'career'"
]));
record('계약 버전 5종 이상', containsAll(templates, [
  "common: '2026.07-v1'",
  "life: '2026.07-life-v1'",
  "business: '2026.07-business-v1'",
  "career: '2026.07-career-v1'",
  "privacy: '2026.07-privacy-v1'"
]));

const requiredClauseIds = [
  'parties',
  'purpose',
  'scope',
  'coach-role',
  'client-role',
  'operation',
  'schedule',
  'fees',
  'changes-refunds',
  'confidentiality',
  'confidentiality-exceptions',
  'records',
  'recording-ai',
  'privacy',
  'conflicts',
  'referral',
  'no-guarantee',
  'intellectual-property',
  'amendments',
  'termination',
  'disputes',
  'electronic-acceptance',
  'copy'
];
record(
  '공통 필수조항 23개',
  requiredClauseIds.every((id) => templates.includes(`id: '${id}'`))
);
record('라이프 코칭·치료 구분', templates.includes('라이프 코칭은 고객의 생각과 자원을 탐색'));
record('라이프 위기 최소공유', templates.includes('필요한 최소 범위'));
record('비즈니스 정보공유 매트릭스', containsAll(templates, [
  'INFORMATION_SHARING_MATRIX',
  '세션의 구체적인 대화',
  '개인적인 감정·고민',
  '종료 요약'
]));
record('비즈니스 스폰서 세션 비소유', templates.includes('세션 내용을 소유하지 않습니다'));
record('커리어 결과 비보장', containsAll(templates, [
  '취업, 합격, 이직, 승진, 연봉 인상',
  '채용기관과 고용주의 결정'
]));
record('개인정보 안내와 선택 동의 분리', containsAll(templates, [
  'PRIVACY_NOTICE',
  'OPTIONAL_CONSENTS'
]));
record('선택 동의 기본값 비동의', !/default:\s*true/.test(templates));
record('미사용 녹음·AI 안내', templates.includes('별도 합의 없이 코칭 세션을 녹음하거나 음성 전사·AI 요약'));
record('고객 휴대전화 필수 처리 안내', templates.includes('성명, 계약 연락용 이메일, 휴대전화번호'));

const agreementHtml = read('coaching/agreement/index.html');
const agreementJs = read('coaching/assets/agreement.js');
const signGatewayJs = read('coaching/assets/sign-gateway.js');
const successHtml = read('coaching/agreement/success/index.html');
record('휴대전화 입력 필수', /id="clientPhone"[^>]*\brequired\b/.test(agreementHtml));
record('휴대전화 사용자 검증', agreementJs.includes("['clientPhone', '고객 휴대전화번호를 입력해 주세요.']"));
record('코칭 목적 별도 필수 입력', /id="coachingPurpose"[^>]*\brequired\b/.test(agreementHtml) &&
  agreementJs.includes("['coachingPurpose', '이 계약의 코칭 목적을 한두 문장으로 입력해 주세요.']"));
record('코칭 목적 미리보기·정식조항 반영', containsAll(agreementJs, [
  "['코칭 목적', state.values.coachingPurpose]",
  '당사자가 합의한 구체적인 코칭 목적'
]));
record('공개 초안은 선택 동의를 수집하지 않음', containsAll(agreementJs, [
  '공개 초안 작성기에서는 선택 동의를 받지 않습니다',
  'dom.optionalConsents.hidden = true',
  'dom.optionalConsents.replaceChildren()'
]) && !agreementJs.includes('config.features?.[configKey] === true'));
record('스폰서 선택 제공항목이 있을 때만 별도 동의 요구', containsAll(
  agreementHtml + agreementJs,
  [
    'id="sponsorDisclosureConsentRow" hidden',
    'const consentRequired = selectedItems.length > 0',
    'if (hasSelectedSponsorSharing && !state.sponsorDisclosureConsent)'
  ]
) && /\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(agreementCss));
record('초안 제공자 필수 운영정보 표시', containsAll(agreementJs, [
  '사업자등록번호',
  '사업장 주소',
  '과세·면세 안내',
  '분쟁 관할·소재지'
]));
record('초안 개인정보 안내 전문 표시', containsAll(agreementJs, [
  '개인정보 처리자',
  '필수 처리항목',
  '선택 처리항목',
  '처리 근거',
  '보유기간',
  '파기방법',
  '고객의 권리',
  '담당자 연락처'
]));

const coachingFiles = gatherFiles(filePath('coaching'));
const coachingText = coachingFiles
  .filter((target) => /\.(?:html|js|css)$/i.test(target))
  .map((target) => fs.readFileSync(target, 'utf8'))
  .join('\n');

record('브라우저 영구저장 코드 없음', !/\b(?:localStorage|sessionStorage|indexedDB|caches\.open)\b/.test(coachingText));
record('신규 페이지 HTML 문자열 삽입 없음', !/\b(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval)\b/.test(coachingText));
record('토큰 URL query 전달 코드 없음', !/[?&](?:token|inviteToken)=/i.test(coachingText));
record('postMessage 와일드카드 없음', !/postMessage\s*\([^)]*,\s*['"]\*['"]/.test(coachingText));
record('임시 Apps Script URL 없음', !/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/(?:exec|dev)/.test(coachingText));
record('런타임 endpoint 기본 비어 있음', /appsScriptUrl:\s*''/.test(runtimeConfig));
record('전자계약 기본 비활성', /electronicContractEnabled:\s*false/.test(runtimeConfig));
record('외부 iframe endpoint 미연결 표시', coachingText.includes('전자계약 시스템 연결 전'));
record('서명 메시지 프로토콜 일치', containsAll(signGatewayJs, [
  "const messageSource = 'dailycoaching-contracts'",
  'DAILYCOACHING_SIGN_READY',
  'DAILYCOACHING_SIGN_TOKEN',
  'DAILYCOACHING_SIGN_TOKEN_RECEIVED',
  'DAILYCOACHING_SIGN_STATUS',
  'DAILYCOACHING_SIGN_COMPLETED',
  'DAILYCOACHING_SIGN_FAILED'
]));
record('iframe no-referrer 적용', signGatewayJs.includes("frame.referrerPolicy = 'no-referrer'"));
record('정적 성공주소가 완료 증명 아님', successHtml.includes('이 정적 주소만으로 전자계약 완료 여부를 증명하지 않습니다'));

for (const relative of ['coaching/agreement/sign/index.html', 'coaching/agreement/success/index.html']) {
  if (!fs.existsSync(filePath(relative))) continue;
  const html = read(relative);
  record(`${relative} noindex`, /noindex/i.test(html));
  record(`${relative} nofollow`, /nofollow/i.test(html));
  record(`${relative} noarchive`, /noarchive/i.test(html));
  record(`${relative} no-referrer`, /name=["']referrer["'][^>]*no-referrer|content=["']no-referrer["'][^>]*name=["']referrer/i.test(html));
}

record('인쇄 A4 CSS', /@page\s*\{[\s\S]*size:\s*A4 portrait/i.test(agreementCss));
record('인쇄 UI 제거 또는 print area 격리', /@media print[\s\S]*body > \*/i.test(agreementCss));
record('초안 워터마크', containsAll(agreementCss, ['draft-watermark', '@media print']));
record('조항 페이지 절단 방지', /page-break-inside:\s*avoid/.test(agreementCss));
record('전자확인 영역 새 인쇄 페이지 고정', /contract-signoff[\s\S]*break-before:\s*page/.test(agreementCss));

const appsRoot = filePath('integrations/google-apps-script/coaching-contracts');
const appsFiles = gatherFiles(appsRoot);
const appsText = appsFiles
  .filter((target) => /\.(?:gs|html|json|md)$/i.test(target))
  .map((target) => fs.readFileSync(target, 'utf8'))
  .join('\n');
const appsCode = read('integrations/google-apps-script/coaching-contracts/Code.gs');
const appsSchema = read('integrations/google-apps-script/coaching-contracts/Schema.gs');
const appsSecurity = read('integrations/google-apps-script/coaching-contracts/SecurityService.gs');
const appsState = read('integrations/google-apps-script/coaching-contracts/StateMachine.gs');
const appsConfig = read('integrations/google-apps-script/coaching-contracts/ConfigService.gs');
const appsContract = read('integrations/google-apps-script/coaching-contracts/ContractService.gs');
const appsInstall = read('integrations/google-apps-script/coaching-contracts/Install.gs');
const appsTerms = read('integrations/google-apps-script/coaching-contracts/ContractTerms.gs');
const appsOtp = read('integrations/google-apps-script/coaching-contracts/OtpService.gs');
const appsPdf = read('integrations/google-apps-script/coaching-contracts/PdfService.gs');
const appsJobs = read('integrations/google-apps-script/coaching-contracts/JobService.gs');
const appsSignPage = read('integrations/google-apps-script/coaching-contracts/SignPage.html');

record('Apps Script 설치 함수', appsCode.includes('function installCoachingContractSystem()'));
record('동시 최초 설치 ScriptLock 보호', containsAll(appsInstall, [
  'function runLocked()',
  'LockService.getScriptLock()',
  'lock.waitLock(30000)',
  'lock.releaseLock()'
]));
record('Apps Script 스프레드시트 메뉴', containsAll(appsCode, [
  'DAILYCOACHING 계약',
  '신규 계약 발행',
  '선택 계약 초대 재발송',
  '선택 계약 PDF 재발송',
  '계약 종료 처리',
  '만료 계약 확인',
  '개인정보 파기 예정 확인',
  '설정 점검'
]));
record('Apps Script 5개 시트', containsAll(appsSchema, [
  'CONTRACTS: CONTRACTS',
  'SIGNERS: SIGNERS',
  'CONSENTS: CONSENTS',
  'AUDIT_LOG: AUDIT_LOG',
  'SETTINGS: SETTINGS'
]));
record('계약 상태 7종', containsAll(appsSchema, [
  "'DRAFT'",
  "'ISSUED'",
  "'CLIENT_VERIFIED'",
  "'SPONSOR_VERIFIED'",
  "'COMPLETED'",
  "'TERMINATED'",
  "'EXPIRED'"
]));
record('DRAFT 체결 차단 allowlist', containsAll(appsState, [
  "var SIGNABLE = Object.freeze([",
  "'ISSUED', 'CLIENT_VERIFIED', 'SPONSOR_VERIFIED'",
  'function assertSignable'
]) && !/SIGNABLE[\s\S]{0,100}'DRAFT'/.test(appsState));
record('128비트 이상 초대 토큰과 HMAC 해시', containsAll(appsSecurity, [
  'Utilities.computeHmacSha256Signature',
  'Utilities.getUuid().replace(/-/g',
  '/^[a-f0-9]{64}$/'
]));
record('Apps Script 비암호 난수 없음', !/\bMath\.random\s*\(/.test(appsText));
record('시트에 원토큰·원OTP 열 없음', !containsAll(appsSchema, ["'rawToken'"]) && !containsAll(appsSchema, ["'rawOtp'"]));
record('OTP 6자리·10분·5회·60초', containsAll(appsOtp, [
  'var OTP_TTL_MS = 10 * 60 * 1000',
  'var OTP_COOLDOWN_MS = 60 * 1000',
  'var OTP_MAX_ATTEMPTS = 5',
  '/^\\d{6}$/'
]));
record('OTP PENDING 중단은 동일 요청 성공으로 오인하지 않음', containsAll(appsOtp, [
  "deliveryReady: String(signer.otpDeliveryStatus) === 'SENT'",
  'if (!prepared.deliveryReady)'
]));
record('ScriptLock 동시성 제어', appsText.includes('LockService.getScriptLock()'));
record('Drive 비공개 강제', appsText.includes('setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE)'));
record('Apps Script ALLOWALL iframe 모드', appsCode.includes('HtmlService.XFrameOptionsMode.ALLOWALL'));
record('Sign URL origin·고정경로 검증', containsAll(appsConfig, [
  'function validateSignPageBaseUrl',
  "'/coaching/agreement/sign/'",
  'allowedParentOrigins().indexOf(origin)'
]));
record('부모·자식 서명 프로토콜 일치', containsAll(appsSignPage, [
  "var messageSource = 'dailycoaching-contracts'",
  'DAILYCOACHING_SIGN_READY',
  'DAILYCOACHING_SIGN_TOKEN',
  'DAILYCOACHING_SIGN_TOKEN_RECEIVED',
  'DAILYCOACHING_SIGN_STATUS',
  'DAILYCOACHING_SIGN_COMPLETED',
  'DAILYCOACHING_SIGN_FAILED'
]));
record('누락 서명자·중단 초대 서버 복구', containsAll(appsContract, [
  'function retryPendingInvitations',
  'missingRoles',
  "status === 'CLAIMED'",
  "status === 'PENDING'",
  'DC.StateMachine.isSignable(contract)'
]));
record('전자확인 pending 서버 복구', containsAll(appsOtp, [
  'function reconcilePendingAcceptances',
  'function completePendingAcceptanceLocked',
  'pendingAcceptanceJson'
]));
record('OTP 성공 응답 중단의 동일 요청 복구', containsAll(appsOtp, [
  'otpVerifyRequestHash',
  'repeatedVerification',
  'deriveAuthSession',
  "detailCode: 'JOURNAL_RECOVERED'"
]));
record('목표 공유 계약은 고객 확인 전 스폰서 대기', containsAll(appsOtp, [
  'function sponsorMustWaitForGoalConsent',
  'SPONSOR_WAITING_FOR_CLIENT',
  'clientProvisionAllowsGoal'
]));
record('역할별 불변 확인증거와 해시 검증', containsAll(appsOtp, [
  'acceptanceEvidenceFileId',
  'acceptanceEvidenceHash',
  'ACCEPTANCE_EVIDENCE_INTEGRITY_FAILED',
  'DC.Security.constantTimeEqual'
]));
record('PDF는 확인증거 기반 동의만 사용', containsAll(appsJobs, [
  'DC.OtpService.verifiedConsentRecord(signer)',
  'DC.PdfService.generate'
]));
record('동의 mirror 변조 시 차단', appsOtp.includes('CONSENT_EVIDENCE_MISMATCH'));
record('PDF·Docs 부분실패 보상 정리', containsAll(appsPdf, [
  'setTrashed(true)',
  'PDF_GENERATION_CLEANUP_FAILED'
]));
record('Google Docs 템플릿 marker 검증·병합', containsAll(appsPdf, [
  'TEMPLATE_MARKERS',
  'function validateTemplateBody',
  'function mergeTemplateHeader',
  'body.replaceText',
  'TEMPLATE_CONTENT_MARKER_MISSING'
]) && !appsPdf.includes('body.clear()'));
record('만료 lease 미참조 생성물 탐색·정리', containsAll(appsPdf + appsJobs, [
  'function discardUnreferencedContractArtifacts',
  'getFilesByName',
  'ORPHAN_ASSET_CLEANUP_FAILED',
  "finalizationStatus: 'CLEANUP_FAILED'"
]));
record('READY 후 누락된 당사자·운영자 전달 재예약', containsAll(appsJobs, [
  "finalizationStatus === 'READY'",
  "['', 'NOT_READY'].indexOf(String(contract.operatorDeliveryStatus))",
  "['', 'NOT_READY'].indexOf(deliveryStatus)",
  "completionDeliveryStatus: 'PENDING'"
]));
record('만료 처리 전 pending 전자확인 우선 복구', containsAll(appsJobs, [
  'function expireContracts',
  'DC.OtpService.reconcilePendingAcceptances(contractId)',
  'var hasPendingIntent = signers.some',
  'if (hasPendingIntent) return;'
]));
record('관리자 종료 전 pending 전자확인 우선 복구', containsAll(appsContract, [
  'function terminate',
  'DC.OtpService.reconcilePendingAcceptances(contractId)',
  'var hasPendingIntent = signers.some',
  '선행 전자확인 기록을 복구하는 동안에는 계약을 종료할 수 없습니다.'
]));
record('모든 계약상태 보유기한·artifact inventory', containsAll(appsContract + appsJobs, [
  'retentionDueAt',
  'function retentionCandidateRecords',
  'presentedSnapshotFileId',
  'acceptanceEvidenceFileId',
  'artifactFileIds'
]));
record('선택동의 상태 4종과 기본 비제시', containsAll(appsSchema + appsText, [
  "'NOT_OFFERED'",
  "'NOT_APPLICABLE'",
  "'DECLINED'",
  "'ACCEPTED'"
]));
record('개인정보 권리·필수/선택 안내', containsAll(appsText, [
  '필수 처리항목',
  '선택 처리항목',
  '열람',
  '정정',
  '삭제',
  '처리정지'
]));
record('Apps Script 고객 휴대전화 필수', read('integrations/google-apps-script/coaching-contracts/ValidationService.gs').includes(
  "clientPhone: phone(source.clientPhone, '고객 휴대전화번호', true)"
));
record('Apps Script 휴대전화 최소 숫자 8자리', containsAll(
  read('integrations/google-apps-script/coaching-contracts/ValidationService.gs'),
  [
    "var digitCount = result.replace(/\\D/g, '').length",
    'digitCount < 8'
  ]
));
record('Apps Script 고객 역할·코칭 목적 필수', containsAll(
  read('integrations/google-apps-script/coaching-contracts/ValidationService.gs'),
  [
    "clientRole: text(source.clientRole, '고객 계약상 역할'",
    "coachingPurpose: contractSummary(source.coachingPurpose, '코칭 목적')"
  ]
));
record('Apps Script 고객 역할·소속·직책·목적 스냅샷', containsAll(appsContract, [
  'role: input.clientRole',
  'organization: input.clientOrganization',
  'title: input.clientTitle',
  'purpose: input.coachingPurpose'
]));
record('Apps Script 단계전환 포커스와 열람본 해시 라벨', containsAll(appsSignPage, [
  'var panelTitles = {',
  'title.focus({ preventScroll: true })',
  '내 열람본 SHA-256'
]));
record('Apps Script 임의 사업자·운영값 없음', containsAll(read('integrations/google-apps-script/coaching-contracts/Config.gs.example'), [
  "WEB_APP_EXEC_URL: ''",
  "SIGN_PAGE_BASE_URL: ''"
]));

try {
  const frontendContext = { window: {} };
  vm.runInNewContext(templates, frontendContext, { filename: 'contract-templates.js' });
  const appsContext = { DC: {} };
  vm.runInNewContext(appsTerms, appsContext, { filename: 'ContractTerms.gs' });
  const frontendContracts = frontendContext.window.DAILYCOACHING_CONTRACTS;
  const backendTerms = appsContext.DC.Terms;
  const types = ['life', 'business', 'career'];
  const versionsMatch = ['common', 'life', 'business', 'career', 'privacy', 'consent']
    .every((key) => frontendContracts.versions[key] === backendTerms.VERSIONS[key]);
  const clausesMatch = types.every((type) => {
    const frontendClauses = frontendContracts.getClauses(type).map((item) => ({
      id: item.id,
      title: item.title,
      summary: item.summary,
      text: item.body
    }));
    return JSON.stringify(frontendClauses) === JSON.stringify(backendTerms.clauses(type));
  });
  record('공개 초안·전자계약 버전과 3종 23개 조항 완전 일치', versionsMatch && clausesMatch);
} catch (error) {
  record('공개 초안·전자계약 버전과 3종 23개 조항 완전 일치', false, error.message);
}

const sourceFiles = [
  ...coachingFiles,
  ...appsFiles,
  ...['docs/coaching-contract-legal-review.md', 'docs/coaching-contract-operations.md']
    .map(filePath)
    .filter(fs.existsSync)
];
const allNewText = sourceFiles
  .filter((target) => /\.(?:html|js|css|gs|md|json)$/i.test(target))
  .map((target) => fs.readFileSync(target, 'utf8'))
  .join('\n');

record('UTF-8 대체문자 없음', !allNewText.includes('\uFFFD'));
record('테스트용 개인정보 없음', !/(홍길동|김테스트|010-1234-5678)/.test(allNewText));
record('가짜 사업자번호 없음', !/(000-00-00000|123-45-67890)/.test(allNewText));
record('example.com 잔존 없음', !/example\.com/i.test(allNewText));
record('TODO/FIXME 잔존 없음', !/\b(?:TODO|FIXME)\b/.test(allNewText));
record('GitHub에 비밀값 형태 없음', !/(?:API_KEY|SECRET|PASSWORD)\s*[:=]\s*['"][^'"]+['"]/i.test(allNewText));

function resolveInternalLink(htmlRelative, href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  if (clean.startsWith('/')) {
    const target = clean.replace(/^\/+/, '');
    if (!target) return filePath('index.html');
    const direct = filePath(target);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
    return path.join(direct, 'index.html');
  }
  return path.resolve(path.dirname(filePath(htmlRelative)), clean);
}

const htmlRelatives = coachingFiles
  .filter((target) => target.endsWith('.html'))
  .map((target) => path.relative(root, target));
const brokenLinks = [];

for (const relative of htmlRelatives) {
  const html = read(relative);
  const hrefPattern = /\shref=["']([^"']+)["']/g;
  for (const match of html.matchAll(hrefPattern)) {
    const href = match[1];
    if (
      href.startsWith('#') ||
      href.startsWith('http:') ||
      href.startsWith('https:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('javascript:')
    ) continue;
    const target = resolveInternalLink(relative, href);
    if (target && !fs.existsSync(target)) brokenLinks.push(`${relative} → ${href}`);
  }
}
record('신규 HTML 내부 링크 유효', brokenLinks.length === 0, brokenLinks.slice(0, 8).join(', '));

console.log(`\nDAILYCOACHING 코칭계약 시스템 자동검수`);
console.log(`통과: ${passes.length}`);
console.log(`실패: ${failures.length}`);

if (failures.length) {
  console.error('\n실패 항목');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('\n모든 자동검수 항목을 통과했습니다.');
}
