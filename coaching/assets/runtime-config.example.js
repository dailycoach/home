/*
 * 이 파일을 복사해 runtime-config.js의 공개 운영값을 채웁니다.
 * API 키, 관리자 비밀번호, 토큰, OTP pepper 등 비밀값은 절대 넣지 않습니다.
 */
window.DAILYCOACHING_CONTRACT_CONFIG = Object.freeze({
  electronicContractEnabled: false,
  appsScriptUrl: '',
  contractManagementUrl: '',
  protocolVersion: 1,
  allowedAppsScriptOrigins: Object.freeze([
    'https://script.google.com',
    'https://script.googleusercontent.com'
  ]),
  provider: Object.freeze({
    serviceName: 'DAILYCOACHING',
    legalName: '',
    representative: '',
    coachName: '',
    coachCredentials: '',
    businessRegistrationNumber: '',
    businessAddress: '',
    phone: '',
    email: '',
    taxNotice: '',
    disputeLocation: ''
  }),
  policies: Object.freeze({
    reschedulePolicy: '',
    noShowPolicy: '',
    refundPolicy: '',
    retentionPeriod: ''
  }),
  // 공개 초안 작성기는 아래 플래그를 활성화해도 선택 동의를 수집하지 않습니다.
  // 항목별 안내와 서버 readiness가 검증된 초대형 전자계약에서만 사용합니다.
  features: Object.freeze({
    recording: false,
    transcription: false,
    aiSummary: false,
    researchUse: false,
    anonymousCaseUse: false,
    publicityUse: false,
    marketing: false,
    thirdPartyTransfer: false
  }),
  compliance: Object.freeze({
    googleProcessingReviewComplete: false,
    overseasTransferNoticeComplete: false,
    legalReviewComplete: false,
    contractManagementReady: false,
    endToEndTestComplete: false
  })
});
