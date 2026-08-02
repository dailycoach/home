const FLOWING_RIVER = Object.freeze({
  schemaVersion: '1.0.0',
  formTitle: '흐르는 강물처럼 창립 멤버 참여 신청',
  spreadsheetTitle: 'NAL_흐르는강물처럼_창립멤버_운영관리',
  responseSheet: '신청응답',
  operationsSheet: '운영관리',
  settingsSheet: '설정',
  dmSheet: 'DM문구',
  responsePlaceholder: 'Google Form 연결 후 원본 응답이 자동 생성됩니다.',
  instagramHandle: 'daily_coach_ing',
  instagramUrl: 'https://www.instagram.com/daily_coach_ing/',
  flexMoveUrl: 'https://daily-coach-ing.com/activities/coaching-flex-move/',
  programUrl: 'https://daily-coach-ing.com/nal/gather/flowing-river-coaches/',
  capacity: 10,
  monthlyFee: 10000,
  firstZoomDate: '2026-09-10',
  zoomTime: '20:00~21:30'
});

const QUESTION = Object.freeze({
  name: '이름',
  instagram: 'Instagram 사용자 이름',
  dmAvailable: 'Instagram DM 가능 여부',
  kakaoName: '카카오톡에서 사용할 이름 또는 닉네임',
  depositor: '입금자명',
  coachingConnection: '현재 코칭과 어떤 방식으로 연결되어 있나요?',
  coachingOrigin: '코칭을 처음 만나거나 관심을 갖게 된 계기는 무엇인가요?',
  coachingReason: '지금도 코칭을 좋아하거나 계속 배우고 싶은 이유는 무엇인가요?',
  expectation: '흐르는 강물처럼에서 가장 기대하는 것은 무엇인가요?',
  zoomAvailability: '매월 10일 오후 8:00~9:30 Zoom에 참여할 수 있나요?',
  coachingExperience: '최근 실제 코칭을 진행한 경험이 있나요?',
  weeklyMission: '주 1회 카카오톡 미션에 어떤 방식으로 참여하고 싶나요?',
  topic: '커뮤니티에서 함께 다루고 싶은 질문이나 주제가 있나요?',
  rules: '커뮤니티 운영규칙 동의',
  flexConsent: 'COACHING FLEX MOVE 활용 동의',
  feeConsent: '참가비와 입장 절차 동의',
  privacy: '개인정보 수집·이용 동의'
});

const OPERATIONS_HEADERS = Object.freeze([
  '신청일시', '이름', 'Instagram ID', 'Instagram URL', '카카오톡 이름', '입금자명',
  '코칭 연결', 'Zoom 가능', '실제 코칭 경험', '신청 상태', 'DM 확인', '결제 상태',
  '입장 안내', '단톡방 입장', '첫 Zoom', '운영 메모'
]);

const STATUS_OPTIONS = Object.freeze({
  application: ['검토 중', '승인', '대기', '거절'],
  dm: ['미확인', '신청완료 DM 확인'],
  payment: ['미안내', '안내', '입금 확인'],
  admission: ['미발송', '발송 완료'],
  kakao: ['미입장', '입장 완료'],
  zoom: ['참석', '불참', '미정']
});

function setupFlowingRiverForm() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = setupOperationsSheet();
    const properties = PropertiesService.getScriptProperties();
    const storedFormId = properties.getProperty('FLOWING_RIVER_FORM_ID');
    let form = storedFormId ? FormApp.openById(storedFormId) : null;

    if (form && form.getItems().length > 0 &&
        properties.getProperty('FLOWING_RIVER_FORM_SCHEMA') !== FLOWING_RIVER.schemaVersion) {
      throw new Error('기존 Form의 스키마 버전이 다릅니다. 응답 보존을 위해 자동 재작성하지 않습니다.');
    }

    if (!form) {
      form = FormApp.create(FLOWING_RIVER.formTitle, false);
      configureForm_(form);
      buildFormItems_(form);
      properties.setProperties({
        FLOWING_RIVER_FORM_ID: form.getId(),
        FLOWING_RIVER_FORM_SCHEMA: FLOWING_RIVER.schemaVersion
      }, false);
    } else {
      configureForm_(form);
    }

    linkResponseDestination_(form, spreadsheet);
    installFormSubmitTrigger_(spreadsheet);
    setSettingValue_('Google Form URL', form.getPublishedUrl(), spreadsheet);
    setSettingValue_('Google Form 편집 URL', form.getEditUrl(), spreadsheet);
    setSettingValue_('Google Spreadsheet URL', spreadsheet.getUrl(), spreadsheet);
    setSettingValue_('설치 상태', 'Form·Sheet 연결 완료', spreadsheet);
    generateInstagramDmTemplates();
    verifyFormConfiguration_(form);

    const result = {
      formId: form.getId(),
      formUrl: form.getPublishedUrl(),
      formEditUrl: form.getEditUrl(),
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
      collectsEmail: form.collectsEmail(),
      itemCount: form.getItems().length
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function configureForm_(form) {
  form
    .setTitle(FLOWING_RIVER.formTitle)
    .setDescription(formDescription_())
    .setConfirmationMessage(confirmationMessage_())
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setPublishingSummary(false)
    .setShowLinkToRespondAgain(false)
    .setAllowResponseEdits(false)
    .setProgressBar(true)
    .setShuffleQuestions(false)
    .setIsQuiz(false);

  if (typeof form.supportsAdvancedResponderPermissions === 'function' &&
      form.supportsAdvancedResponderPermissions()) {
    form.setPublished(true);
  } else {
    form.setAcceptingResponses(true);
  }
}

function buildFormItems_(form) {
  form.addSectionHeaderItem()
    .setTitle('섹션 1. 기본정보')
    .setHelpText('이메일과 휴대전화 번호는 수집하지 않습니다.');

  form.addTextItem().setTitle(QUESTION.name).setRequired(true);
  form.addTextItem()
    .setTitle(QUESTION.instagram)
    .setHelpText('예: daily_coach_ing · @ 기호 또는 전체 Instagram 프로필 URL도 입력할 수 있습니다.')
    .setRequired(true);

  const dmRoute = form.addMultipleChoiceItem().setTitle(QUESTION.dmAvailable).setRequired(true);
  form.addTextItem().setTitle(QUESTION.kakaoName).setRequired(true);
  form.addTextItem()
    .setTitle(QUESTION.depositor)
    .setHelpText('결제 확인을 위해 사용합니다.')
    .setRequired(true);

  const dmWarningPage = form.addPageBreakItem()
    .setTitle('Instagram DM 안내')
    .setHelpText('현재 흐르는 강물처럼의 승인·결제·입장 안내는 Instagram DM으로만 진행됩니다. 신청을 계속하려면 @daily_coach_ing 계정의 DM을 사용할 수 있어야 합니다.');
  const coachingPage = form.addPageBreakItem()
    .setTitle('섹션 2. 코칭과의 연결')
    .setHelpText('자격이나 경력의 우열을 판단하기 위한 문항이 아닙니다.');

  dmRoute.setChoices([
    dmRoute.createChoice('@daily_coach_ing을 팔로우했고 신청완료 DM을 보내겠습니다.', coachingPage),
    dmRoute.createChoice('신청 후 바로 팔로우하고 DM을 보내겠습니다.', coachingPage),
    dmRoute.createChoice('Instagram DM 사용이 어렵습니다.', dmWarningPage)
  ]);
  dmWarningPage.setGoToPage(coachingPage);

  form.addCheckboxItem()
    .setTitle(QUESTION.coachingConnection)
    .setChoiceValues([
      '현업 코치로 활동하고 있습니다.',
      '코치 자격과정이나 교육과정에 참여하고 있습니다.',
      '코칭을 공부하고 있습니다.',
      '코칭을 받아본 경험이 있습니다.',
      '일과 관계에서 코칭 대화를 활용하고 있습니다.',
      '코칭 경험은 많지 않지만 배우고 싶습니다.'
    ])
    .showOtherOption(true)
    .setRequired(true);
  form.addParagraphTextItem().setTitle(QUESTION.coachingOrigin).setRequired(true);
  form.addParagraphTextItem().setTitle(QUESTION.coachingReason).setRequired(true);
  form.addCheckboxItem()
    .setTitle(QUESTION.expectation)
    .setChoiceValues([
      '코칭을 좋아하는 사람들과의 연결',
      '질문과 경청에 대한 대화',
      '실제 코칭 이후의 성찰',
      '코치로 살아가는 과정의 고민 나눔',
      'COACHING FLEX MOVE 실습',
      '주 1회 카카오톡 미션',
      '월 1회 Zoom'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addPageBreakItem()
    .setTitle('섹션 3. 참여 가능 여부')
    .setHelpText('Zoom 참여 여부와 실제 코칭 경험에 따라 LIVE FLEX 또는 SELF FLEX 활동을 안내합니다.');
  form.addMultipleChoiceItem()
    .setTitle(QUESTION.zoomAvailability)
    .setChoiceValues([
      '대부분 참여할 수 있습니다.',
      '일정에 따라 일부 참여할 수 있습니다.',
      'Zoom 참여는 어렵지만 카카오톡 활동에 참여하고 싶습니다.'
    ])
    .setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle(QUESTION.coachingExperience)
    .setHelpText('Zoom에서 LIVE FLEX 또는 SELF FLEX 활동을 구분하기 위해 사용합니다.')
    .setChoiceValues([
      '최근 1개월 내 실제 코칭을 진행했습니다.',
      '이전에 코칭을 진행한 경험이 있습니다.',
      '실습 코칭 경험이 있습니다.',
      '아직 실제 코칭 경험은 없습니다.'
    ])
    .setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle(QUESTION.weeklyMission)
    .setChoiceValues([
      '매주 적극적으로 참여하고 싶습니다.',
      '가능한 주에 자유롭게 참여하고 싶습니다.',
      '다른 사람의 글을 읽고 반응하는 방식으로 참여하고 싶습니다.',
      '아직 잘 모르겠습니다.'
    ])
    .setRequired(true);
  form.addParagraphTextItem().setTitle(QUESTION.topic).setRequired(false);

  form.addPageBreakItem()
    .setTitle('섹션 4. 운영규칙 동의')
    .setHelpText('안전한 코칭 커뮤니티 운영을 위해 각 항목을 모두 확인해 주세요.');
  addAllRequiredCheckbox_(form, QUESTION.rules, [
    '고객과 참여자를 식별할 수 있는 개인정보와 사례를 공유하지 않겠습니다.',
    '단톡방과 Zoom 내용을 캡처·녹음하거나 외부에 전달하지 않겠습니다.',
    '요청받지 않은 코칭, 해석과 조언을 제공하지 않겠습니다.',
    '운영자 동의 없이 홍보, 판매와 개인 영업을 하지 않겠습니다.',
    '자격, 경력과 소속을 근거로 다른 참여자를 평가하지 않겠습니다.',
    '차별, 혐오, 성희롱과 공격적인 표현을 사용하지 않겠습니다.',
    '반복적인 규칙 위반 시 참여가 제한될 수 있음에 동의합니다.'
  ]);
  addAllRequiredCheckbox_(form, QUESTION.flexConsent, [
    'LIVE FLEX는 실제 코칭 이후의 개인 성찰을 위해 사용하겠습니다.',
    '고객 이름, 소속, 직업과 민감정보를 입력하거나 공유하지 않겠습니다.',
    '다른 참여자의 결과를 평가하거나 진단하지 않겠습니다.',
    '실제 코칭 경험이 없는 경우 SELF FLEX를 사용하겠습니다.'
  ]);
  addAllRequiredCheckbox_(form, QUESTION.feeConsent, [
    '월 참가비가 10,000원임을 확인했습니다.',
    '자동결제가 아닌 월 단위 수동 결제임을 확인했습니다.',
    'Instagram DM으로 참가 승인과 결제 안내가 발송됨을 확인했습니다.',
    '결제 확인 후 Instagram DM으로 카카오톡 입장 링크와 참여코드가 발송됨을 확인했습니다.'
  ]);

  const privacyItem = form.addMultipleChoiceItem()
    .setTitle(QUESTION.privacy)
    .setHelpText(privacyConsentText_())
    .setRequired(true);
  form.addPageBreakItem()
    .setTitle('신청 제출')
    .setHelpText('개인정보 수집·이용에 동의한 경우에만 신청이 제출됩니다.');
  privacyItem.setChoices([
    privacyItem.createChoice('동의합니다.', FormApp.PageNavigationType.SUBMIT),
    privacyItem.createChoice('동의하지 않습니다.', FormApp.PageNavigationType.RESTART)
  ]);
}

function addAllRequiredCheckbox_(form, title, options) {
  const item = form.addCheckboxItem()
    .setTitle(title)
    .setChoiceValues(options)
    .setRequired(true);
  const validation = FormApp.createCheckboxValidation()
    .setHelpText('모든 항목을 확인하고 선택해야 다음 단계로 진행할 수 있습니다.')
    .requireSelectExactly(options.length)
    .build();
  item.setValidation(validation);
  return item;
}

function formDescription_() {
  return [
    '흐르는 강물처럼은 자격이나 경력보다 코칭을 좋아하는 마음으로 연결되는 월간 커뮤니티입니다.',
    '',
    '카카오톡 단톡방에서 주 1회 코칭 미션에 참여하고, 매월 10일 오후 8시에 Zoom으로 만납니다.',
    'Zoom에서는 COACHING FLEX MOVE를 활용해 코칭이나 대화 이후의 생각, 질문, 개입과 선택을 함께 돌아봅니다.',
    '',
    '· 창립 멤버: 10명',
    '· 참가비: 월 10,000원',
    '· Zoom: 매월 10일 오후 8:00~9:30',
    '· 주간 활동: 주 1회 카카오톡 미션',
    '· 공식 문의: Instagram @daily_coach_ing',
    '',
    '신청서를 제출한 뒤 @daily_coach_ing을 팔로우하고 다음 형식으로 DM을 보내 주세요.',
    '흐르는 강물처럼 신청완료 / 신청자 이름',
    '',
    '운영자가 신청 내용을 확인한 후 Instagram DM으로 참가 승인과 결제 방법을 안내합니다.',
    '결제가 확인되면 같은 DM으로 카카오톡 단톡방 입장 링크, 참여코드와 안내문을 보내드립니다.'
  ].join('\n');
}

function privacyConsentText_() {
  return [
    '수집 항목: 이름, Instagram 사용자 이름, 카카오톡 이름, 입금자명, 참여 신청 내용',
    '이용 목적: 신청자 확인, 참가 승인, 결제 확인, 카카오톡 단톡방 입장 안내, Zoom 및 커뮤니티 운영',
    '보유 기간: 신청 결과 통보일로부터 30일. 참가 승인·결제 완료자는 커뮤니티 참여 종료 후 30일까지. 관계 법령상 보존 의무가 있는 결제 기록은 해당 기간 동안 보관할 수 있습니다.',
    '동의 거부: 개인정보 수집·이용에 동의하지 않을 권리가 있습니다. 다만 신청자 확인과 운영 안내가 불가능해 참여 신청을 완료할 수 없습니다.'
  ].join('\n');
}

function confirmationMessage_() {
  return [
    '신청이 정상적으로 접수되었습니다.',
    '',
    '이제 Instagram에서 다음 단계를 완료해 주세요.',
    '1. @daily_coach_ing 계정을 팔로우합니다.',
    '2. Instagram DM으로 아래 메시지를 보냅니다.',
    '',
    '흐르는 강물처럼 신청완료 / [신청자 이름]',
    '',
    '운영자가 신청 내용과 Instagram 계정을 확인한 후 참가 승인과 월 참가비 결제 방법을 DM으로 안내합니다.',
    '결제가 확인되면 같은 DM으로 카카오톡 단톡방 입장 링크, 참여코드, 커뮤니티 안내문과 첫 Zoom 일정을 보내드립니다.',
    '',
    '첫 공식 Zoom: 2026년 9월 10일 오후 8:00~9:30',
    '활용 도구: COACHING FLEX MOVE',
    'Instagram: https://www.instagram.com/daily_coach_ing/'
  ].join('\n');
}

function setupOperationsSheet(spreadsheet) {
  const ss = spreadsheet || getOperationsSpreadsheet_();
  PropertiesService.getScriptProperties().setProperty('FLOWING_RIVER_SPREADSHEET_ID', ss.getId());
  setupResponsePlaceholder_(ss);
  setupOperationsTab_(ss);
  setupSettingsTab_(ss);
  setupDmTab_(ss);
  createOperationsMenu();
  return ss;
}

function getOperationsSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const storedId = properties.getProperty('FLOWING_RIVER_SPREADSHEET_ID');
  if (storedId) return SpreadsheetApp.openById(storedId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    properties.setProperty('FLOWING_RIVER_SPREADSHEET_ID', active.getId());
    return active;
  }
  const created = SpreadsheetApp.create(FLOWING_RIVER.spreadsheetTitle);
  properties.setProperty('FLOWING_RIVER_SPREADSHEET_ID', created.getId());
  return created;
}

function setupResponsePlaceholder_(ss) {
  let sheet = ss.getSheetByName(FLOWING_RIVER.responseSheet);
  if (!sheet) sheet = ss.insertSheet(FLOWING_RIVER.responseSheet, 0);
  if (sheet.getLastRow() === 0 || sheet.getRange('A1').getValue() === '') {
    sheet.getRange('A1:B2').setValues([
      [FLOWING_RIVER.responsePlaceholder, '이 시트는 수동 편집하지 않습니다.'],
      ['설치 함수', 'setupFlowingRiverForm()']
    ]);
    sheet.getRange('A1:B1').setFontWeight('bold').setBackground('#F1F3F4');
    sheet.setColumnWidth(1, 330);
    sheet.setColumnWidth(2, 330);
    sheet.setFrozenRows(1);
  }
}

function setupOperationsTab_(ss) {
  const sheet = getOrCreateSheet_(ss, FLOWING_RIVER.operationsSheet);
  ensureRows_(sheet, 1000);
  sheet.getRange(1, 1, 1, OPERATIONS_HEADERS.length).setValues([OPERATIONS_HEADERS]);
  sheet.getRange(1, 1, 1, OPERATIONS_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#F1F3F4')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  sheet.setRowHeight(1, 36);
  [150, 110, 150, 125, 130, 115, 250, 180, 220, 100, 135, 105, 105, 105, 90, 280]
    .forEach(function(width, index) { sheet.setColumnWidth(index + 1, width); });
  sheet.getRange(2, 1, sheet.getMaxRows() - 1, OPERATIONS_HEADERS.length)
    .setVerticalAlignment('top')
    .setWrap(true);
  sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  setListValidation_(sheet.getRange(2, 10, sheet.getMaxRows() - 1, 1), STATUS_OPTIONS.application);
  setListValidation_(sheet.getRange(2, 11, sheet.getMaxRows() - 1, 1), STATUS_OPTIONS.dm);
  setListValidation_(sheet.getRange(2, 12, sheet.getMaxRows() - 1, 1), STATUS_OPTIONS.payment);
  setListValidation_(sheet.getRange(2, 13, sheet.getMaxRows() - 1, 1), STATUS_OPTIONS.admission);
  setListValidation_(sheet.getRange(2, 14, sheet.getMaxRows() - 1, 1), STATUS_OPTIONS.kakao);
  setListValidation_(sheet.getRange(2, 15, sheet.getMaxRows() - 1, 1), STATUS_OPTIONS.zoom);
  if (!sheet.getFilter()) {
    sheet.getRange(1, 1, sheet.getMaxRows(), OPERATIONS_HEADERS.length).createFilter();
  }
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('입금 확인').setBackground('#E6F4EA').setFontColor('#137333')
      .setRanges([sheet.getRange(2, 12, sheet.getMaxRows() - 1, 1)]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('대기').setBackground('#FEF7E0').setFontColor('#B06000')
      .setRanges([sheet.getRange(2, 10, sheet.getMaxRows() - 1, 1)]).build()
  ]);
  if (sheet.getRange('B2').getDisplayValue() === '샘플 행 · 실제 신청 전 삭제') {
    sheet.getRange(2, 1, 1, OPERATIONS_HEADERS.length).clearContent();
  }
}

function setupSettingsTab_(ss) {
  const sheet = getOrCreateSheet_(ss, FLOWING_RIVER.settingsSheet);
  sheet.getRange('A1:D1').setValues([['설정 항목', '값', '공개 범위', '운영 메모']]);
  sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#F1F3F4');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 190);
  sheet.setColumnWidth(2, 390);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 360);
  [
    ['월 참가비', FLOWING_RIVER.monthlyFee, '공개', '월 단위 수동 결제'],
    ['정원', FLOWING_RIVER.capacity, '공개', '입금 확인 인원 기준'],
    ['첫 Zoom 날짜', FLOWING_RIVER.firstZoomDate, '공개', '2026년 9월 10일'],
    ['Zoom 시간', FLOWING_RIVER.zoomTime, '공개', '매월 10일'],
    ['Instagram 계정', '@' + FLOWING_RIVER.instagramHandle, '공개', FLOWING_RIVER.instagramUrl],
    ['카카오톡 입장 링크', '', '비공개', '공개 페이지와 Form 완료 화면에 입력하지 않음'],
    ['카카오톡 참여코드', '', '비공개', '결제 확인 후 Instagram DM으로만 안내'],
    ['결제 계좌', '', '비공개', '승인 DM 템플릿에만 사용'],
    ['입금기한 안내', '', '비공개', '예: 승인일로부터 3일'],
    ['입장기한 안내', '', '비공개', '운영자 입력'],
    ['결제 안내문', '', '비공개', '운영자 확정'],
    ['운영규칙 URL', FLOWING_RIVER.programUrl, '공개', '상세 페이지의 함께 지킬 약속'],
    ['COACHING FLEX MOVE URL', FLOWING_RIVER.flexMoveUrl, '공개', 'Zoom 활용 도구'],
    ['Google Form URL', '', '공개', 'setupFlowingRiverForm 실행 후 자동 입력'],
    ['Google Form 편집 URL', '', '비공개', '운영자만 사용'],
    ['Google Spreadsheet URL', ss.getUrl(), '비공개', '운영자만 사용'],
    ['설치 상태', '운영 시트 준비', '비공개', 'Form 연결 전'],
    ['정원 현황', '0 / ' + FLOWING_RIVER.capacity, '비공개', '입금 확인 인원 기준']
  ].forEach(function(row) { upsertSettingRow_(sheet, row); });
  sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 4)
    .setWrap(true).setVerticalAlignment('top');
}

function setupDmTab_(ss) {
  const sheet = getOrCreateSheet_(ss, FLOWING_RIVER.dmSheet);
  sheet.getRange('A1:C3').setValues([
    ['Instagram DM 운영 문구', '', '자동 발송하지 않습니다.'],
    ['선택 Instagram ID', '', '운영관리의 Instagram ID를 선택합니다.'],
    ['선택 신청자', '', 'DM 문구 새로고침 시 표시됩니다.']
  ]);
  sheet.getRange('A1:C1').setFontWeight('bold').setBackground('#F1F3F4');
  sheet.getRange('A5:C5').setValues([['문구', '사용 시점', '복사할 메시지']]);
  sheet.getRange('A5:C5').setFontWeight('bold').setBackground('#F1F3F4');
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 190);
  sheet.setColumnWidth(3, 760);
  sheet.getRange('C1:C20').setWrap(true).setVerticalAlignment('top');
  const operations = ss.getSheetByName(FLOWING_RIVER.operationsSheet);
  if (operations) {
    sheet.getRange('B2').setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInRange(operations.getRange('C2:C1000'), true)
        .setAllowInvalid(true).build()
    );
  }
}

function generateInstagramDmTemplates(instagramId) {
  const ss = getOperationsSpreadsheet_();
  const sheet = ss.getSheetByName(FLOWING_RIVER.dmSheet) || getOrCreateSheet_(ss, FLOWING_RIVER.dmSheet);
  setupDmTab_(ss);
  const selectedId = normalizeInstagramHandle(instagramId || sheet.getRange('B2').getDisplayValue());
  const applicant = findApplicant_(ss, selectedId);
  const templates = createDmTemplates_(applicant, getSettingsMap_(ss));
  sheet.getRange('B2').setValue(selectedId || '');
  sheet.getRange('B3').setValue(applicant.name || '신청자 미선택');
  sheet.getRange(6, 1, Math.max(sheet.getMaxRows() - 5, 1), 3).clearContent();
  sheet.getRange(6, 1, templates.length, 3).setValues(templates);
  sheet.getRange(6, 1, templates.length, 3).setWrap(true).setVerticalAlignment('top');
  return templates;
}

function createDmTemplates_(applicant, settings) {
  const name = applicant.name || '[이름]';
  const depositor = applicant.depositor || '[신청서 입금자명]';
  const kakaoName = applicant.kakaoName || '[신청서 작성 이름]';
  const account = settings['결제 계좌'] || '[운영자 입력]';
  const paymentDeadline = settings['입금기한 안내'] || '[운영자 입력]';
  const joinDeadline = settings['입장기한 안내'] || '[운영자 입력]';
  const kakaoLink = settings['카카오톡 입장 링크'] || '[카카오톡 링크]';
  const kakaoCode = settings['카카오톡 참여코드'] || '[참여코드]';
  return [
    ['참가 승인·결제 안내', '신청 승인 후', [
      '안녕하세요, ' + name + '님.', '', '흐르는 강물처럼 창립 멤버 신청이 확인되었습니다.',
      '코칭을 사랑하는 사람들이 질문과 실천을 오래 이어가는 첫 커뮤니티에 함께 신청해 주셔서 감사합니다.',
      '', '참가비는 월 10,000원이며 자동결제가 아닌 월 단위 수동 결제입니다.', '',
      '입금 안내:', '· 금액: 10,000원', '· 입금계좌: ' + account,
      '· 입금자명: ' + depositor, '· 입금기한: ' + paymentDeadline, '',
      '결제가 확인되면 이 Instagram DM으로 카카오톡 단톡방 입장 링크, 참여코드와 안내문을 보내드립니다.',
      '첫 Zoom은 2026년 9월 10일 오후 8:00~9:30이며 COACHING FLEX MOVE를 활용합니다.',
      FLOWING_RIVER.flexMoveUrl, '', '입금 후 DM으로 입금완료 / 이름을 보내 주세요.'
    ].join('\n')],
    ['결제 확인·입장 안내', '입금 확인 후', [
      '안녕하세요, ' + name + '님.', '', '흐르는 강물처럼 창립 멤버 참가비가 확인되었습니다.', '',
      '· 카카오톡 입장 링크: ' + kakaoLink, '· 참여코드: ' + kakaoCode,
      '· 입장기한: ' + joinDeadline, '· 카카오톡 이름: ' + kakaoName, '',
      '입장 후 공지방의 운영규칙과 첫 Zoom 안내를 확인해 주세요.',
      '첫 공식 Zoom: 2026년 9월 10일 오후 8:00~9:30',
      '주제: 코칭 이후, 나는 무엇을 보고 있었는가',
      'Zoom 링크는 단톡방에서 별도로 안내합니다.'
    ].join('\n')],
    ['신청 대기 안내', '검토가 더 필요할 때', '안녕하세요, ' + name + '님.\n흐르는 강물처럼 신청이 확인되었습니다. 현재 신청 순서와 창립 멤버 정원을 확인하고 있습니다. 확정되는 대로 이 Instagram DM으로 안내드리겠습니다.'],
    ['정원 마감 안내', '입금 확인 10명 이후', '안녕하세요, ' + name + '님.\n흐르는 강물처럼 창립 멤버 10명 모집이 마감되어 대기 신청으로 접수되었습니다. 자리가 열리거나 다음 모집 일정이 확정되면 이 Instagram DM으로 먼저 안내드리겠습니다.'],
    ['미입금 안내', '입금기한 전 확인', '안녕하세요, ' + name + '님.\n흐르는 강물처럼 참가비 입금 여부를 확인하고 있습니다. 참여를 원하시면 안내드린 기한까지 입금 후 입금완료 / 이름을 보내 주세요. 일정 조정이 필요하면 이 DM으로 말씀해 주세요.'],
    ['첫 Zoom 리마인드', '첫 Zoom 전', '안녕하세요, ' + name + '님.\n흐르는 강물처럼 첫 Zoom은 2026년 9월 10일 오후 8:00~9:30입니다. Zoom 링크는 카카오톡 단톡방 공지를 확인해 주세요. 고객을 식별할 정보 없이 COACHING FLEX MOVE에 사용할 최근 장면 하나를 준비해 주세요.'],
    ['다음 달 갱신 안내', '월말', '안녕하세요, ' + name + '님.\n다음 달 흐르는 강물처럼 참여 여부를 확인합니다. 계속 참여하실 경우 월 참가비 10,000원을 안내된 계좌로 입금한 뒤 갱신완료 / 이름을 보내 주세요. 자동결제는 진행되지 않습니다.']
  ];
}

function normalizeInstagramHandle(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  if (/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i.test(text)) {
    try {
      const url = new URL(/^https?:\/\//i.test(text) ? text : 'https://' + text);
      text = url.pathname.split('/').filter(Boolean)[0] || '';
    } catch (error) {
      text = text.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\//i, '');
    }
  }
  text = text.split(/[/?#]/)[0].replace(/^@+/, '').trim().toLowerCase();
  return text.replace(/[^a-z0-9._]/g, '');
}

function onFormSubmit(e) {
  if (!e || !e.namedValues) {
    syncApplicationRows();
    return;
  }
  const timestamp = e.range ? e.range.getCell(1, 1).getValue() : new Date();
  upsertApplication_(e.namedValues, timestamp);
  generateInstagramDmTemplates(namedValue_(e.namedValues, QUESTION.instagram));
}

function syncApplicationRows() {
  const ss = getOperationsSpreadsheet_();
  const responseSheet = findResponseSheet_(ss);
  if (!responseSheet || responseSheet.getLastRow() < 2) return 0;
  const values = responseSheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  let synced = 0;
  values.forEach(function(row) {
    if (!row.some(function(value) { return value !== ''; })) return;
    const namedValues = {};
    headers.forEach(function(header, index) {
      if (header && index > 0) namedValues[header] = [row[index]];
    });
    if (upsertApplication_(namedValues, row[0])) synced += 1;
  });
  return synced;
}

function upsertApplication_(namedValues, timestamp) {
  const ss = getOperationsSpreadsheet_();
  const sheet = ss.getSheetByName(FLOWING_RIVER.operationsSheet);
  if (!sheet) throw new Error('운영관리 시트가 없습니다. setupOperationsSheet()를 먼저 실행하세요.');
  const name = namedValue_(namedValues, QUESTION.name);
  const instagramId = normalizeInstagramHandle(namedValue_(namedValues, QUESTION.instagram));
  const key = applicationKey_(timestamp, name, instagramId);
  if (existingApplicationKeys_(sheet).has(key)) return false;
  const status = checkCapacity(false).full ? '대기' : '검토 중';
  const nextRow = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(nextRow, 1, 1, OPERATIONS_HEADERS.length).setValues([[
    timestamp || new Date(), name, instagramId, '',
    namedValue_(namedValues, QUESTION.kakaoName),
    namedValue_(namedValues, QUESTION.depositor),
    namedValue_(namedValues, QUESTION.coachingConnection),
    namedValue_(namedValues, QUESTION.zoomAvailability),
    namedValue_(namedValues, QUESTION.coachingExperience),
    status, '미확인', '미안내', '미발송', '미입장', '미정', ''
  ]]);
  if (instagramId) {
    sheet.getRange(nextRow, 4).setFormula('=HYPERLINK("https://www.instagram.com/' + instagramId + '/","프로필 열기")');
  }
  sheet.getRange(nextRow, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  return true;
}

function existingApplicationKeys_(sheet) {
  const keys = new Set();
  if (sheet.getLastRow() < 2) return keys;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues().forEach(function(row) {
    keys.add(applicationKey_(row[0], row[1], row[2]));
  });
  return keys;
}

function applicationKey_(timestamp, name, instagramId) {
  const time = timestamp instanceof Date ? timestamp.getTime() : String(timestamp || '');
  return [time, String(name || '').trim(), normalizeInstagramHandle(instagramId)].join('|');
}

function namedValue_(namedValues, title) {
  const value = namedValues[title];
  if (Array.isArray(value)) return value.map(String).join(', ').trim();
  return String(value || '').trim();
}

function checkCapacity(showToast) {
  const ss = getOperationsSpreadsheet_();
  const sheet = ss.getSheetByName(FLOWING_RIVER.operationsSheet);
  const capacity = Number(getSettingsMap_(ss)['정원']) || FLOWING_RIVER.capacity;
  let confirmed = 0;
  if (sheet && sheet.getLastRow() >= 2) {
    confirmed = sheet.getRange(2, 12, sheet.getLastRow() - 1, 1)
      .getDisplayValues().flat()
      .filter(function(value) { return value === '입금 확인'; }).length;
  }
  const result = {
    capacity: capacity,
    confirmed: confirmed,
    available: Math.max(capacity - confirmed, 0),
    full: confirmed >= capacity
  };
  setSettingValue_('정원 현황', confirmed + ' / ' + capacity, ss);
  if (showToast !== false) {
    try {
      SpreadsheetApp.getActive().toast(
        result.full ? '정원 ' + capacity + '명이 모두 입금 확인되었습니다.' :
          '입금 확인 ' + confirmed + '명 · 남은 자리 ' + result.available + '명',
        '흐르는 강물처럼', 6
      );
    } catch (error) {
      console.log(JSON.stringify(result));
    }
  }
  return result;
}

function markWaitlist() {
  const ss = getOperationsSpreadsheet_();
  const sheet = ss.getSheetByName(FLOWING_RIVER.operationsSheet);
  if (!checkCapacity(false).full || !sheet || sheet.getLastRow() < 2) return 0;
  const range = sheet.getRange(2, 10, sheet.getLastRow() - 1, 1);
  const values = range.getValues();
  let changed = 0;
  values.forEach(function(row) {
    if (row[0] === '검토 중') {
      row[0] = '대기';
      changed += 1;
    }
  });
  range.setValues(values);
  return changed;
}

function onEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== FLOWING_RIVER.operationsSheet) return;
  if (e.range.getColumn() === 12) {
    if (checkCapacity(true).full) markWaitlist();
    return;
  }
  if (e.range.getColumn() === 10 && checkCapacity(false).full) markWaitlist();
}

function createOperationsMenu() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('흐르는 강물처럼')
      .addItem('Form·운영시트 초기 설정', 'setupFlowingRiverForm')
      .addSeparator()
      .addItem('신청응답 동기화', 'syncApplicationRows')
      .addItem('정원 확인', 'checkCapacity')
      .addItem('대기 상태 반영', 'markWaitlist')
      .addItem('DM 문구 새로고침', 'generateInstagramDmTemplates')
      .addToUi();
  } catch (error) {
    console.log('메뉴는 스프레드시트에 바인딩된 스크립트에서 표시됩니다.');
  }
}

function onOpen() {
  createOperationsMenu();
}

function linkResponseDestination_(form, ss) {
  if (form.getDestinationId() !== ss.getId()) {
    const placeholder = ss.getSheetByName(FLOWING_RIVER.responseSheet);
    if (isResponsePlaceholder_(placeholder)) placeholder.setName(FLOWING_RIVER.responseSheet + '_준비');
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    SpreadsheetApp.flush();
    Utilities.sleep(1500);
  }
  const responseSheet = waitForResponseSheet_(ss, form.getPublishedUrl());
  if (!responseSheet) throw new Error('Google Form 응답 시트를 찾지 못했습니다.');
  const existing = ss.getSheetByName(FLOWING_RIVER.responseSheet);
  if (existing && existing.getSheetId() !== responseSheet.getSheetId() && isResponsePlaceholder_(existing)) {
    ss.deleteSheet(existing);
  }
  const prepared = ss.getSheetByName(FLOWING_RIVER.responseSheet + '_준비');
  if (prepared && isResponsePlaceholder_(prepared)) ss.deleteSheet(prepared);
  if (responseSheet.getName() !== FLOWING_RIVER.responseSheet) responseSheet.setName(FLOWING_RIVER.responseSheet);
  responseSheet.setFrozenRows(1);
}

function waitForResponseSheet_(ss, formUrl) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const found = ss.getSheets().find(function(sheet) {
      try {
        return sheet.getFormUrl() === formUrl;
      } catch (error) {
        return false;
      }
    });
    if (found) return found;
    Utilities.sleep(500);
  }
  return null;
}

function findResponseSheet_(ss) {
  const named = ss.getSheetByName(FLOWING_RIVER.responseSheet);
  if (named && !isResponsePlaceholder_(named)) return named;
  return ss.getSheets().find(function(sheet) {
    try {
      return Boolean(sheet.getFormUrl());
    } catch (error) {
      return false;
    }
  }) || null;
}

function isResponsePlaceholder_(sheet) {
  if (!sheet || sheet.getLastRow() > 3) return false;
  return [
    FLOWING_RIVER.responsePlaceholder,
    'Google Form 원본 응답'
  ].includes(sheet.getRange('A1').getDisplayValue());
}

function installFormSubmitTrigger_(ss) {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) { return trigger.getHandlerFunction() === 'onFormSubmit'; })
    .forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(ss).onFormSubmit().create();
}

function verifyFormConfiguration_(form) {
  const errors = [];
  if (form.collectsEmail()) errors.push('이메일 자동 수집이 켜져 있습니다.');
  if (typeof form.hasLimitOneResponsePerUser === 'function' && form.hasLimitOneResponsePerUser()) {
    errors.push('1인 1응답 제한은 로그인 요구 가능성이 있어 꺼야 합니다.');
  }
  if (form.getItems(FormApp.ItemType.FILE_UPLOAD).length > 0) errors.push('파일 업로드 문항이 포함돼 있습니다.');
  if (form.getItems().length < 20) errors.push('필수 문항 또는 섹션이 누락됐을 수 있습니다.');
  if (errors.length) throw new Error(errors.join('\n'));
  return true;
}

function findApplicant_(ss, instagramId) {
  const empty = { name: '', instagramId: '', kakaoName: '', depositor: '' };
  if (!instagramId) return empty;
  const sheet = ss.getSheetByName(FLOWING_RIVER.operationsSheet);
  if (!sheet || sheet.getLastRow() < 2) return empty;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, OPERATIONS_HEADERS.length).getDisplayValues();
  const row = rows.find(function(values) {
    return normalizeInstagramHandle(values[2]) === instagramId;
  });
  return row ? { name: row[1], instagramId: row[2], kakaoName: row[4], depositor: row[5] } : empty;
}

function getSettingsMap_(ss) {
  const sheet = ss.getSheetByName(FLOWING_RIVER.settingsSheet);
  const result = {};
  if (!sheet || sheet.getLastRow() < 2) return result;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues().forEach(function(row) {
    if (row[0]) result[row[0]] = row[1];
  });
  return result;
}

function setSettingValue_(key, value, spreadsheet) {
  const ss = spreadsheet || getOperationsSpreadsheet_();
  const sheet = ss.getSheetByName(FLOWING_RIVER.settingsSheet) ||
    getOrCreateSheet_(ss, FLOWING_RIVER.settingsSheet);
  const row = findSettingRow_(sheet, key);
  if (row) sheet.getRange(row, 2).setValue(value);
  else sheet.appendRow([key, value, '비공개', '자동 생성']);
}

function upsertSettingRow_(sheet, values) {
  const row = findSettingRow_(sheet, values[0]);
  if (!row) {
    sheet.appendRow(values);
    return;
  }
  if (sheet.getRange(row, 2).getValue() === '') sheet.getRange(row, 2).setValue(values[1]);
  sheet.getRange(row, 3, 1, 2).setValues([[values[2], values[3]]]);
}

function findSettingRow_(sheet, key) {
  if (sheet.getLastRow() < 2) return 0;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues().flat();
  const index = values.indexOf(key);
  return index === -1 ? 0 : index + 2;
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureRows_(sheet, minimumRows) {
  if (sheet.getMaxRows() < minimumRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), minimumRows - sheet.getMaxRows());
  }
}

function setListValidation_(range, values) {
  range.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(false)
      .build()
  );
}
