/**
 * RS에듀컨설팅 LMC Academy 구매→신청→결제확인→Vimeo 강의실 입장 자동화
 *
 * 설치 위치: 운영DB 스프레드시트 > 확장 프로그램 > Apps Script
 * 운영DB: RS 온라인강의 자동화 운영DB v1.0
 */

const RSEDU_ACADEMY = Object.freeze({
  VERSION: '1.1.0',
  DEFAULT_SPREADSHEET_ID: '1qmeLbGeQZSrOJAoXtger_Wi6Ii7jO0n4kghq8ab2rDc',
  DEFAULT_COURSE_ID: 'lmc-lifetime-management-counselor',
  HEADER_ROW: 2,
  DATA_START_ROW: 3,
  SHEETS: Object.freeze({
    STUDENTS: '수강생',
    COURSES: '과정설정',
    MEDIA: '영상목록',
    SESSIONS: '세션',
    LOGS: '발송로그',
    SMARTSTORE: '스마트스토어',
    SETTINGS: '설정',
    INSTALL: '설치안내'
  }),
  STUDENT: Object.freeze({
    ID: 1,
    APPLIED_AT: 2,
    COURSE_ID: 3,
    ORDER_NO: 4,
    CHANNEL: 5,
    BUYER_NAME: 6,
    STUDENT_NAME: 7,
    EMAIL: 8,
    PHONE: 9,
    CONSENT: 10,
    PAYMENT_STATUS: 11,
    PAYMENT_AT: 12,
    CODE_HINT: 13,
    CODE_HASH: 14,
    CODE_ISSUED_AT: 15,
    ACCESS_EXPIRES_AT: 16,
    ACCESS_STATUS: 17,
    MAIL_STATUS: 18,
    MAIL_AT: 19,
    LAST_ACCESS_AT: 20,
    ACCESS_COUNT: 21,
    ERROR: 22,
    NOTE: 23
  }),
  SESSION: Object.freeze({
    ID: 1,
    TOKEN_HASH: 2,
    STUDENT_ID: 3,
    COURSE_ID: 4,
    CREATED_AT: 5,
    EXPIRES_AT: 6,
    LAST_CHECKED_AT: 7,
    STATUS: 8,
    USER_AGENT_HASH: 9,
    NOTE: 10
  }),
  FORM_TITLES: Object.freeze({
    COURSE: '수강 과정을 선택해 주세요.',
    ORDER_NO: '스마트스토어 상품주문번호를 입력해 주세요.',
    BUYER_NAME: '스마트스토어 주문자명을 입력해 주세요.',
    STUDENT_NAME: '수강생 성함을 입력해 주세요.',
    EMAIL: '입장코드를 받을 이메일을 입력해 주세요.',
    PHONE: '휴대전화 번호를 입력해 주세요.',
    CONSENT: '개인정보 수집·이용에 동의합니다.'
  })
});

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('LMC 자동화')
      .addItem('① 최초 설치·신청서 생성', 'setupAcademyAutomation')
      .addItem('② 웹앱 배포 URL 동기화', 'syncDeploymentUrl')
      .addSeparator()
      .addItem('선택 수강생 결제확인·권한발급', 'provisionSelectedStudent')
      .addItem('선택 수강생 입장코드 재발급', 'reissueSelectedStudentCode')
      .addItem('선택 수강생 접근정지', 'suspendSelectedStudent')
      .addItem('만료권한 지금 점검', 'expireStudentAccesses')
      .addSeparator()
      .addItem('자동화 자체점검', 'runAcademySelfTest')
      .addToUi();
  } catch (error) {
    console.warn('[LMC Academy] menu skipped:', error);
  }
}

/** 최초 1회 실행: Form, Script Properties, installable triggers, Sheet URL 연결. */
function setupAcademyAutomation() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('SPREADSHEET_ID')) props.setProperty('SPREADSHEET_ID', RSEDU_ACADEMY.DEFAULT_SPREADSHEET_ID);
    ensureSecretProperty_('CODE_PEPPER');
    ensureSecretProperty_('SESSION_PEPPER');
    ensureSecretProperty_('SYNC_SECRET');

    const ss = getSpreadsheet_();
    validateRequiredSheets_(ss);
    const course = getCourseSettings_(ss, RSEDU_ACADEMY.DEFAULT_COURSE_ID);
    const form = getOrCreateRegistrationForm_(ss, course);
    installAutomationTriggers_(ss, form);
    ensureExpiryTrigger_();
    writeRegistrationUrls_(ss, course, form);
    updateInstallStatus_(ss, 1, '완료');
    updateInstallStatus_(ss, 2, '완료');
    updateInstallStatus_(ss, 3, ScriptApp.getService().getUrl() ? '완료' : '진행중');
    updateInstallStatus_(ss, 6, '진행중');

    const result = {
      ok: true,
      version: RSEDU_ACADEMY.VERSION,
      formUrl: form.getPublishedUrl(),
      formEditUrl: form.getEditUrl(),
      webAppUrl: ScriptApp.getService().getUrl() || '',
      message: 'Google Form과 Vimeo 강의실 입장 자동화 트리거가 준비되었습니다.'
    };
    console.log(JSON.stringify(result));
    showUiMessage_('LMC 자동화 설치', `${result.message}\n\n신청서: ${result.formUrl}\n\n다음 단계: 웹앱으로 배포한 뒤 “웹앱 배포 URL 동기화”를 실행하세요.`);
    return result;
  } finally {
    lock.releaseLock();
  }
}

/** 웹앱 배포 후 실행: 배포 URL을 설정 시트에 기록. */
function syncDeploymentUrl() {
  const url = ScriptApp.getService().getUrl();
  if (!url) throw new Error('웹앱 배포 URL을 찾지 못했습니다. 먼저 새 배포 > 웹앱 배포를 완료해 주세요.');
  const ss = getSpreadsheet_();
  setSettingValue_(ss, 'APPS_SCRIPT_WEB_APP_URL', url);
  updateInstallStatus_(ss, 3, '완료');
  updateInstallStatus_(ss, 4, '진행중');
  showUiMessage_('웹앱 URL 동기화', `설정 시트에 기록했습니다.\n\n${url}\n\n이 URL을 사이트 access-config.js의 apiUrl에 입력해야 실제 로그인이 활성화됩니다.`);
  return url;
}

/** Google Form 제출 installable trigger. */
function handleFormSubmit(event) {
  if (!event || !event.response) throw new Error('Form submit event가 없습니다. 수동 실행하지 마세요.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet_();
    const answers = responseMap_(event.response);
    const course = getCourseSettings_(ss, RSEDU_ACADEMY.DEFAULT_COURSE_ID);

    const orderNo = normalizeOrderNo_(answerByAliases_(answers, [RSEDU_ACADEMY.FORM_TITLES.ORDER_NO, '상품주문번호', '주문번호']));
    const buyerName = cleanText_(answerByAliases_(answers, [RSEDU_ACADEMY.FORM_TITLES.BUYER_NAME, '주문자명']));
    const studentName = cleanText_(answerByAliases_(answers, [RSEDU_ACADEMY.FORM_TITLES.STUDENT_NAME, '수강생명', '수강생 이름']));
    const email = normalizeEmail_(answerByAliases_(answers, [RSEDU_ACADEMY.FORM_TITLES.EMAIL, '등록 이메일', '이메일']));
    const phone = normalizePhone_(answerByAliases_(answers, [RSEDU_ACADEMY.FORM_TITLES.PHONE, '휴대전화']));
    const consent = cleanText_(answerByAliases_(answers, [RSEDU_ACADEMY.FORM_TITLES.CONSENT, '개인정보동의']));

    if (!orderNo || !buyerName || !studentName || !isValidEmail_(email) || !phone) throw new Error('필수 신청정보가 누락되었거나 이메일 형식이 올바르지 않습니다.');
    if (!/동의/.test(consent)) throw new Error('개인정보 수집·이용 동의가 확인되지 않았습니다.');

    const duplicate = findStudentByOrder_(ss, orderNo);
    if (duplicate) {
      writeLog_(ss, duplicate.id, orderNo, email, 'FORM_DUPLICATE', 'SKIPPED', '이미 등록된 상품주문번호', 0);
      return { ok: true, duplicate: true, studentId: duplicate.id };
    }

    const now = new Date();
    const id = createId_('REG');
    const row = new Array(23).fill('');
    row[RSEDU_ACADEMY.STUDENT.ID - 1] = id;
    row[RSEDU_ACADEMY.STUDENT.APPLIED_AT - 1] = event.response.getTimestamp() || now;
    row[RSEDU_ACADEMY.STUDENT.COURSE_ID - 1] = course.courseId;
    row[RSEDU_ACADEMY.STUDENT.ORDER_NO - 1] = orderNo;
    row[RSEDU_ACADEMY.STUDENT.CHANNEL - 1] = '스마트스토어';
    row[RSEDU_ACADEMY.STUDENT.BUYER_NAME - 1] = buyerName;
    row[RSEDU_ACADEMY.STUDENT.STUDENT_NAME - 1] = studentName;
    row[RSEDU_ACADEMY.STUDENT.EMAIL - 1] = email;
    row[RSEDU_ACADEMY.STUDENT.PHONE - 1] = phone;
    row[RSEDU_ACADEMY.STUDENT.CONSENT - 1] = '동의';
    row[RSEDU_ACADEMY.STUDENT.PAYMENT_STATUS - 1] = '결제대기';
    row[RSEDU_ACADEMY.STUDENT.ACCESS_STATUS - 1] = '대기';
    row[RSEDU_ACADEMY.STUDENT.MAIL_STATUS - 1] = '미발송';
    row[RSEDU_ACADEMY.STUDENT.NOTE - 1] = 'Google Form 자동등록';

    const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
    const targetRow = Math.max(sheet.getLastRow() + 1, RSEDU_ACADEMY.DATA_START_ROW);
    sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    writeLog_(ss, id, orderNo, email, 'FORM_RECEIVED', 'SUCCESS', '', 0);
    return { ok: true, studentId: id, row: targetRow };
  } catch (error) {
    const ss = getSpreadsheet_();
    writeLog_(ss, '', '', '', 'FORM_RECEIVED', 'ERROR', error.message, 0);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/** 수강생 시트 K열(결제상태) installable onEdit trigger. */
function handlePaymentEdit(event) {
  if (!event || !event.range) return;
  const sheet = event.range.getSheet();
  if (sheet.getName() !== RSEDU_ACADEMY.SHEETS.STUDENTS) return;
  if (event.range.getRow() < RSEDU_ACADEMY.DATA_START_ROW) return;
  if (event.range.getColumn() !== RSEDU_ACADEMY.STUDENT.PAYMENT_STATUS) return;

  const value = String(event.value || '').trim();
  const row = event.range.getRow();
  try {
    if (value === '확인완료') {
      const ss = sheet.getParent();
      sheet.getRange(row, RSEDU_ACADEMY.STUDENT.PAYMENT_AT).setValue(new Date());
      provisionStudentRow_(ss, row, { forceNewCode: false, source: 'PAYMENT_EDIT' });
    } else if (value === '취소' || value === '환불') {
      suspendStudentRow_(sheet.getParent(), row, value);
    }
  } catch (error) {
    sheet.getRange(row, RSEDU_ACADEMY.STUDENT.ERROR).setValue(error.message);
    sheet.getRange(row, RSEDU_ACADEMY.STUDENT.MAIL_STATUS).setValue('발송오류');
    throw error;
  }
}

function provisionSelectedStudent() {
  const target = selectedStudentRow_();
  target.sheet.getRange(target.row, RSEDU_ACADEMY.STUDENT.PAYMENT_STATUS).setValue('확인완료');
  target.sheet.getRange(target.row, RSEDU_ACADEMY.STUDENT.PAYMENT_AT).setValue(new Date());
  const result = provisionStudentRow_(target.ss, target.row, { forceNewCode: false, source: 'MANUAL_MENU' });
  showUiMessage_('수강권한 발급', `${result.studentName}님에게 Vimeo 강의실 입장코드를 발급했습니다.`);
  return result;
}

function reissueSelectedStudentCode() {
  const target = selectedStudentRow_();
  const result = provisionStudentRow_(target.ss, target.row, { forceNewCode: true, source: 'REISSUE_MENU' });
  showUiMessage_('입장코드 재발급', `${result.studentName}님에게 새 입장코드를 발송했습니다. 기존 코드는 더 이상 사용할 수 없습니다.`);
  return result;
}

function suspendSelectedStudent() {
  const target = selectedStudentRow_();
  const result = suspendStudentRow_(target.ss, target.row, '관리자 정지');
  showUiMessage_('접근 정지', `${result.studentName}님의 입장코드와 활성 세션을 종료했습니다.`);
  return result;
}
