var DC = DC || {};

DC.Schema = (function () {
  var VERSION = '2026.07-v1';

  var CONTRACTS = [
    'contractId', 'contractType', 'contractMode', 'status', 'serviceStatus',
    'termsVersion', 'privacyNoticeVersion', 'consentVersion', 'rowVersion',
    'issuanceRequestHash', 'issuanceInputHash', 'issuanceStatus',
    'issuanceSnapshotJson',
    'createdAt', 'issuedAt', 'acceptanceDeadline', 'completedAt',
    'terminatedAt', 'expiredAt', 'issuedBy', 'supersedesContractId',
    'clientName', 'clientEmail', 'clientPhone', 'clientRole',
    'clientOrganization', 'clientTitle',
    'sponsorName', 'sponsorEmail', 'sponsorOrganization',
    'coachName', 'sessions', 'sessionMinutes', 'deliveryMode',
    'deliveryLocation', 'startDate', 'endDate', 'totalFee',
    'perSessionFee', 'paymentMethod', 'paymentSchedule',
    'cancellationPolicy', 'noShowPolicy', 'refundPolicy',
    'coachingPurpose', 'goalSummary',
    'providerServiceName', 'providerRepresentative', 'providerCoachName',
    'providerCoachCredential', 'providerBusinessNumber', 'providerAddress',
    'providerPhone', 'providerEmail', 'providerTaxNotice',
    'providerJurisdiction', 'informationSharingVersion',
    'sponsorShareAttendance', 'sponsorShareScheduleProgress',
    'sponsorShareAgreedGoals', 'sponsorShareSessionContent',
    'sponsorSharePersonalConcerns', 'sponsorShareClosingSummary',
    'sponsorShareSafetyLegalMinimum', 'termsSnapshotFileId',
    'contractSnapshotFileId', 'documentHashAlgorithm', 'documentHash',
    'acceptanceEvidenceHash', 'docFileId', 'pdfFileId',
    'finalizationStatus', 'finalizationLeaseId',
    'finalizationLeaseExpiresAt', 'finalizationAttemptCount',
    'nextFinalizationAttemptAt', 'lastFinalizationErrorCode',
    'pdfHashAlgorithm', 'pdfHash', 'pdfGeneratedAt',
    'sponsorDocFileId', 'sponsorPdfFileId', 'sponsorPdfHashAlgorithm',
    'sponsorPdfHash', 'sponsorPdfGeneratedAt',
    'operatorDeliveryStatus', 'operatorDeliveryLeaseId',
    'operatorDeliveryLeaseExpiresAt', 'operatorDeliveryAttemptCount',
    'operatorNextDeliveryAttemptAt', 'retentionDueAt',
    'destructionStatus', 'managementStatus', 'withdrawalStatus',
    'terminationRequestStatus', 'changeRequestStatus',
    'consentWithdrawalStatus', 'privacyRightsRequestStatus',
    'lastManagementRequestAt', 'lastUpdatedAt'
  ];

  var SIGNERS = [
    'contractId', 'signerId', 'signerRole', 'signerName', 'signerEmail',
    'emailNormalized', 'status', 'rowVersion',
    'tokenHashVersion', 'tokenHash', 'tokenIssuedAt', 'tokenExpiresAt',
    'tokenUsedAt', 'tokenRevokedAt', 'tokenStatus',
    'inviteDeliveryStatus', 'inviteDeliveryAttemptCount',
    'inviteLastSentAt', 'inviteNextAttemptAt',
    'otpChallengeId', 'otpHashVersion', 'otpHash', 'otpExpiresAt',
    'otpAttemptCount', 'otpLastSentAt', 'otpDeliveryStatus',
    'otpRequestWindowStartedAt', 'otpRequestCount',
    'otpFailureWindowStartedAt', 'otpFailureCount', 'otpLockedUntil',
    'otpVerifiedAt', 'otpVerifyRequestHash',
    'authSessionHashVersion', 'authSessionHash',
    'authSessionExpiresAt', 'authSessionUsedAt',
    'presentedSnapshotFileId', 'presentedDocumentHashAlgorithm',
    'presentedDocumentHash', 'presentedSourceDocumentHash',
    'acceptedAt', 'acceptanceVersion', 'acceptedDocumentHash',
    'acceptedSourceDocumentHash',
    'acceptanceEvidenceHash', 'acceptanceEvidenceFileId',
    'acceptanceRequestHash',
    'acceptancePayloadHash', 'acceptanceStage', 'pendingAcceptanceJson',
    'completionDeliveryStatus',
    'completionDeliveryLeaseId', 'completionDeliveryLeaseExpiresAt',
    'completionDeliveryAttemptCount', 'completionLastSentAt',
    'completionNextAttemptAt', 'completionDocumentHashAlgorithm',
    'completionDocumentHash', 'completionDocumentGeneratedAt',
    'lastUpdatedAt'
  ];

  var CONSENTS = [
    'consentId', 'contractId', 'signerId', 'signerRole',
    'recordingStatus', 'transcriptionStatus', 'aiSummaryStatus',
    'researchUseStatus', 'anonymousCaseUseStatus',
    'testimonialPublicityStatus', 'marketingEmailStatus',
    'marketingSmsStatus', 'thirdPartyTransferStatus',
    'sponsorProvisionStatus', 'sponsorProvisionRecipient',
    'sponsorProvisionPurpose', 'sponsorProvidedItems',
    'sponsorProvisionRetention', 'sponsorRefusalNoticeVersion',
    'sponsorProvisionConfirmedAt',
    'privacyNoticeVersion', 'privacyNoticeAcknowledgedAt',
    'consentVersion', 'acceptedDocumentHash', 'acceptanceEvidenceHash',
    'acceptanceRequestHash', 'createdAt'
  ];

  var AUDIT_LOG = [
    'eventId', 'contractId', 'signerId', 'eventType', 'actorRole',
    'eventAt', 'version', 'result', 'previousStatus', 'nextStatus',
    'requestIdHash', 'correlationId', 'detailCode', 'attemptNumber',
    'safeMetadataJson'
  ];

  var SETTINGS = [
    'key', 'value', 'category', 'required', 'updatedAt', 'updatedBy', 'notes'
  ];

  var SHEETS = Object.freeze({
    CONTRACTS: CONTRACTS,
    SIGNERS: SIGNERS,
    CONSENTS: CONSENTS,
    AUDIT_LOG: AUDIT_LOG,
    SETTINGS: SETTINGS
  });

  var SETTING_DEFINITIONS = [
    ['SERVICE_NAME', '', 'provider', true, '계약서에 표시할 상호 또는 서비스명'],
    ['REPRESENTATIVE', '', 'provider', true, '대표자명'],
    ['COACH_NAME', '', 'provider', true, '담당 코치명'],
    ['COACH_CREDENTIAL', '', 'provider', true, '검증된 자격 표기'],
    ['BUSINESS_REGISTRATION_NUMBER', '', 'provider', true, '실제 사업자등록번호'],
    ['BUSINESS_ADDRESS', '', 'provider', true, '실제 사업장 주소'],
    ['CONTACT_PHONE', '', 'provider', true, '계약 문의 연락처'],
    ['CONTACT_EMAIL', '', 'provider', true, '계약 문의 이메일'],
    ['TAX_NOTICE', '', 'provider', true, '과세·면세 안내'],
    ['JURISDICTION', '', 'legal', true, '검토된 분쟁 관할 또는 사업장 소재지'],
    ['CANCELLATION_POLICY_DEFAULT', '', 'operations', true, '검토된 일정변경·취소 기준'],
    ['NO_SHOW_POLICY_DEFAULT', '', 'operations', true, '검토된 노쇼 기준'],
    ['REFUND_POLICY_DEFAULT', '', 'operations', true, '검토된 중도종료·환불 기준'],
    ['PAYMENT_METHOD_DEFAULT', '', 'operations', true, '실제 결제방법'],
    ['PRIVACY_CONTACT', '', 'privacy', true, '개인정보 문의 담당자와 연락처'],
    ['RETENTION_MONTHS', '', 'privacy', true, '법률 검토를 거친 계약기록 보유 개월 수'],
    ['DESTRUCTION_METHOD', '', 'privacy', true, '검토된 전자기록 파기방법'],
    ['GOOGLE_PROCESSOR_NAME', '', 'privacy', true, '검토된 Google 처리위탁 수탁자 표기'],
    ['GOOGLE_PROCESSING_PURPOSE', '', 'privacy', true, '검토된 처리위탁 목적'],
    ['GOOGLE_PROCESSING_ITEMS', '', 'privacy', true, '검토된 처리위탁 항목'],
    ['GOOGLE_PROCESSING_RETENTION', '', 'privacy', true, '검토된 처리위탁 보유·이용기간'],
    ['GOOGLE_PROCESSOR_DISCLOSURE_CONFIRMED', '', 'privacy', true, '검토 완료 후 YES'],
    ['CROSS_BORDER_RECIPIENT', '', 'privacy', true, '검토된 국외 이전받는 자'],
    ['CROSS_BORDER_COUNTRY', '', 'privacy', true, '검토된 이전 국가 또는 저장 위치 설명'],
    ['CROSS_BORDER_TRANSFER_METHOD', '', 'privacy', true, '검토된 이전 일시·방법'],
    ['CROSS_BORDER_TRANSFER_PURPOSE', '', 'privacy', true, '검토된 이전 목적'],
    ['CROSS_BORDER_TRANSFER_ITEMS', '', 'privacy', true, '검토된 이전 항목'],
    ['CROSS_BORDER_RETENTION', '', 'privacy', true, '검토된 국외 보유·이용기간'],
    ['CROSS_BORDER_TRANSFER_REVIEW_CONFIRMED', '', 'privacy', true, '검토 완료 후 YES'],
    ['LEGAL_REVIEW_CONFIRMED', '', 'legal', true, '계약·개인정보 문구 최종 검토 후 YES'],
    ['RECORDING_AI_MODE', '', 'operations', true, 'NOT_USED 또는 SEPARATE_CONSENT_ENABLED'],
    ['OFFER_RECORDING_CONSENT', '', 'consent', true, '실제 운영 여부를 검토해 YES 또는 NO'],
    ['OFFER_TRANSCRIPTION_CONSENT', '', 'consent', true, '실제 운영 여부를 검토해 YES 또는 NO'],
    ['OFFER_AI_SUMMARY_CONSENT', '', 'consent', true, '실제 운영 여부를 검토해 YES 또는 NO'],
    ['SESSION_PROCESSING_NOTICE_VERSION', '', 'consent', false, '녹음·전사·AI 선택동의 안내 버전'],
    ['RECORDING_PURPOSE', '', 'consent', false, '녹음 목적'],
    ['RECORDING_SCOPE', '', 'consent', false, '녹음 처리범위와 방법'],
    ['RECORDING_RETENTION', '', 'consent', false, '녹음 보유·이용기간'],
    ['TRANSCRIPTION_PROVIDER', '', 'consent', false, '음성 전사 도구·수탁자'],
    ['TRANSCRIPTION_PURPOSE', '', 'consent', false, '음성 전사 목적'],
    ['TRANSCRIPTION_SCOPE', '', 'consent', false, '음성 전사 처리범위'],
    ['TRANSCRIPTION_RETENTION', '', 'consent', false, '음성 전사 보유·이용기간'],
    ['AI_SUMMARY_PROVIDER', '', 'consent', false, 'AI 요약 도구·수탁자'],
    ['AI_SUMMARY_PURPOSE', '', 'consent', false, 'AI 요약 목적'],
    ['AI_SUMMARY_SCOPE', '', 'consent', false, 'AI 요약 처리범위'],
    ['AI_SUMMARY_RETENTION', '', 'consent', false, 'AI 요약 보유·이용기간'],
    ['OFFER_RESEARCH_CONSENT', '', 'consent', true, '실제 운영 여부를 검토해 YES 또는 NO'],
    ['OFFER_ANONYMOUS_CASE_CONSENT', '', 'consent', true, '실제 운영 여부를 검토해 YES 또는 NO'],
    ['OFFER_TESTIMONIAL_CONSENT', '', 'consent', true, '실제 운영 여부를 검토해 YES 또는 NO'],
    ['OFFER_MARKETING_EMAIL_CONSENT', '', 'consent', true, '실제 운영 여부를 검토해 YES 또는 NO'],
    ['OFFER_MARKETING_SMS_CONSENT', '', 'consent', true, '실제 운영 여부를 검토해 YES 또는 NO'],
    ['OFFER_THIRD_PARTY_TRANSFER_CONSENT', '', 'consent', true, '실제 운영 여부를 검토해 YES 또는 NO'],
    ['OPTIONAL_CONSENT_NOTICE_VERSION', '', 'consent', false, '일반 선택동의 안내 버전'],
    ['RESEARCH_PURPOSE', '', 'consent', false, '연구 활용 목적'],
    ['RESEARCH_ITEMS', '', 'consent', false, '연구 활용 항목·범위'],
    ['RESEARCH_RETENTION', '', 'consent', false, '연구자료 보유기간'],
    ['ANONYMOUS_CASE_PURPOSE', '', 'consent', false, '익명 사례 활용 목적'],
    ['ANONYMOUS_CASE_ITEMS', '', 'consent', false, '익명 사례 활용 항목·범위'],
    ['ANONYMOUS_CASE_RETENTION', '', 'consent', false, '익명 사례 보유기간'],
    ['TESTIMONIAL_PURPOSE', '', 'consent', false, '후기·홍보 활용 목적'],
    ['TESTIMONIAL_ITEMS', '', 'consent', false, '후기·홍보 활용 항목·범위'],
    ['TESTIMONIAL_RETENTION', '', 'consent', false, '후기·홍보 보유기간'],
    ['MARKETING_EMAIL_SENDER', '', 'consent', false, '마케팅 이메일 발신자'],
    ['MARKETING_EMAIL_PURPOSE', '', 'consent', false, '마케팅 이메일 목적'],
    ['MARKETING_EMAIL_ITEMS', '', 'consent', false, '마케팅 이메일 처리항목'],
    ['MARKETING_EMAIL_RETENTION', '', 'consent', false, '마케팅 이메일 보유기간'],
    ['MARKETING_SMS_SENDER', '', 'consent', false, '마케팅 문자 발신자'],
    ['MARKETING_SMS_PURPOSE', '', 'consent', false, '마케팅 문자 목적'],
    ['MARKETING_SMS_ITEMS', '', 'consent', false, '마케팅 문자 처리항목'],
    ['MARKETING_SMS_RETENTION', '', 'consent', false, '마케팅 문자 보유기간'],
    ['THIRD_PARTY_RECIPIENT', '', 'consent', false, '선택 제3자 제공받는 자'],
    ['THIRD_PARTY_PURPOSE', '', 'consent', false, '선택 제3자 제공 목적'],
    ['THIRD_PARTY_ITEMS', '', 'consent', false, '선택 제3자 제공 항목'],
    ['THIRD_PARTY_RETENTION', '', 'consent', false, '선택 제3자 보유기간'],
    ['SIGN_PAGE_BASE_URL', '', 'operations', true, '공개 서명 관문 HTTPS 주소'],
    ['CONTRACT_ACCEPTANCE_DAYS', '', 'operations', true, '초대 유효 일수'],
    ['INFORMATION_SHARING_VERSION', '', 'business', true, '조직지원 정보공유 기준 버전'],
    ['SPONSOR_PROVISION_NOTICE_VERSION', '', 'business', true, '스폰서 제공 동의 안내 버전'],
    ['SPONSOR_INFORMATION_RETENTION', '', 'business', true, '스폰서 제공정보 보유·이용기간'],
    ['SPONSOR_PROVISION_REFUSAL_NOTICE', '', 'business', true, '제공 동의 거부 권리와 불이익 안내'],
    ['WITHDRAWAL_POLICY', '', 'management', true, '검토된 청약철회 접수·처리 기준'],
    ['CONTRACT_CHANGE_POLICY', '', 'management', true, '검토된 계약 변경 요청 기준'],
    ['CONSENT_WITHDRAWAL_POLICY', '', 'management', true, '선택동의 철회 접수·처리 기준'],
    ['PRIVACY_RIGHTS_REQUEST_POLICY', '', 'management', true, '열람·정정·삭제·처리정지 요청 기준'],
    ['CONTRACT_MANAGEMENT_CONTACT', '', 'management', true, '계약관리 요청 접수 연락처'],
    ['CONTRACT_MANAGEMENT_REVIEW_CONFIRMED', '', 'management', true, '계약관리 절차 검토 완료 후 YES']
  ];

  var CONTRACT_STATUSES = Object.freeze([
    'DRAFT', 'ISSUED', 'CLIENT_VERIFIED', 'SPONSOR_VERIFIED',
    'COMPLETED', 'TERMINATED', 'EXPIRED'
  ]);

  var CONSENT_STATUSES = Object.freeze([
    'NOT_OFFERED', 'NOT_APPLICABLE', 'DECLINED', 'ACCEPTED'
  ]);

  return Object.freeze({
    VERSION: VERSION,
    SHEETS: SHEETS,
    SETTING_DEFINITIONS: SETTING_DEFINITIONS,
    CONTRACT_STATUSES: CONTRACT_STATUSES,
    CONSENT_STATUSES: CONSENT_STATUSES
  });
})();
