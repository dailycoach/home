/** Form 설치, Sheet 조회, 검증, 보안 유틸리티 */

function getOrCreateRegistrationForm_(ss, course) {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty('FORM_ID');
  if (existingId) {
    try {
      const existingForm = FormApp.openById(existingId);
      existingForm.setPublished(true);
      existingForm.setDescription(registrationDescription_(course));
      existingForm.setConfirmationMessage(registrationConfirmationMessage_(course));
      existingForm.getItems(FormApp.ItemType.TEXT).forEach(function(item) {
        const textItem = item.asTextItem();
        if (textItem.getTitle() === RSEDU_ACADEMY.FORM_TITLES.EMAIL) {
          textItem.setHelpText('입장코드를 받을 이메일 주소를 정확히 입력해 주세요.');
          textItem.setValidation(registrationEmailValidation_());
        }
      });
      return existingForm;
    } catch (error) {
      console.warn('Saved FORM_ID is unavailable:', error);
    }
  }

  const form = FormApp.create(`${course.courseName} 수강생 등록 신청서`);
  form.setPublished(true);
  form.setDescription(registrationDescription_(course));
  form.setCollectEmail(false);
  form.setProgressBar(true);
  form.setConfirmationMessage(registrationConfirmationMessage_(course));
  form.addListItem().setTitle(RSEDU_ACADEMY.FORM_TITLES.COURSE).setChoiceValues([course.courseName]).setRequired(true);
  form.addTextItem().setTitle(RSEDU_ACADEMY.FORM_TITLES.ORDER_NO).setHelpText('스마트스토어 주문상세의 상품주문번호를 공백 없이 입력해 주세요.').setRequired(true);
  form.addTextItem().setTitle(RSEDU_ACADEMY.FORM_TITLES.BUYER_NAME).setRequired(true);
  form.addTextItem().setTitle(RSEDU_ACADEMY.FORM_TITLES.STUDENT_NAME).setRequired(true);
  form.addTextItem()
    .setTitle(RSEDU_ACADEMY.FORM_TITLES.EMAIL)
    .setHelpText('입장코드와 수강안내를 받을 이메일 주소입니다.')
    .setValidation(registrationEmailValidation_())
    .setRequired(true);
  form.addTextItem().setTitle(RSEDU_ACADEMY.FORM_TITLES.PHONE).setRequired(true);
  form.addCheckboxItem().setTitle(RSEDU_ACADEMY.FORM_TITLES.CONSENT).setChoiceValues(['동의합니다']).setRequired(true);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  props.setProperty('FORM_ID', form.getId());
  props.setProperty('FORM_URL', form.getPublishedUrl());
  return form;
}

function registrationDescription_(course) {
  return [
    '스마트스토어 구매 후 작성하는 수강생 등록 신청서입니다.',
    '결제 확인 후 아래 이메일로 8자리 입장코드를 보내드립니다.',
    '강의는 승인된 수강생이 비공개 Cloudflare R2 재생 게이트를 통해 시청합니다.',
    `수강 과정: ${course.courseName}`
  ].join('\n');
}

function registrationConfirmationMessage_(course) {
  return [
    '신청이 완료되었습니다.',
    '결제·주문 확인 후 입장코드가 입력한 이메일로 발송됩니다.',
    '강의실 입장: ' + course.entryUrl,
    '메일이 보이지 않으면 스팸함과 프로모션함을 확인해 주세요.'
  ].join('\n\n');
}

function registrationEmailValidation_() {
  return FormApp.createTextValidation()
    .setHelpText('입장코드를 받을 올바른 이메일 주소를 입력해 주세요.')
    .requireTextIsEmail()
    .build();
}

function installAutomationTriggers_(ss, form) {
  const handlers = new Set(['handleFormSubmit', 'handlePaymentEdit']);
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlers.has(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('handleFormSubmit').forForm(form).onFormSubmit().create();
  ScriptApp.newTrigger('handlePaymentEdit').forSpreadsheet(ss).onEdit().create();
}

function writeRegistrationUrls_(ss, course, form) {
  const formUrl = form.getPublishedUrl();
  const courseSheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.COURSES);
  courseSheet.getRange(course.row, 4).setValue(formUrl);

  const smartSheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.SMARTSTORE);
  const messageCell = smartSheet.getRange(5, 2);
  const base = String(messageCell.getValue() || '').replace(/\n\n수강생 등록 신청서:\s*https?:\/\/\S+/g, '').trim();
  messageCell.setValue(`${base}\n\n수강생 등록 신청서: ${formUrl}`);
  smartSheet.getRange(5, 3).setValue('신청서 URL 삽입 완료 · 판매자센터 메시지 등록 전 최종 검수');
  smartSheet.getRange(5, 4).setValue('검수필요');
}

function findActiveStudent_(ss, email, courseId) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
  const lastRow = sheet.getLastRow();
  if (lastRow < RSEDU_ACADEMY.DATA_START_ROW) return null;
  const values = sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW, 1, lastRow - RSEDU_ACADEMY.HEADER_ROW, 23).getValues();
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const student = studentObject_(values[i], RSEDU_ACADEMY.DATA_START_ROW + i);
    if (student.email === email && student.courseId === courseId && student.paymentStatus === '확인완료' && student.accessStatus === '활성') return student;
  }
  return null;
}

function findStudentById_(ss, id) {
  if (!id) return null;
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
  const lastRow = sheet.getLastRow();
  if (lastRow < RSEDU_ACADEMY.DATA_START_ROW) return null;
  const range = sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW, RSEDU_ACADEMY.STUDENT.ID, lastRow - RSEDU_ACADEMY.HEADER_ROW, 1);
  const cell = range.createTextFinder(String(id)).matchEntireCell(true).findNext();
  if (!cell) return null;
  const rowNumber = cell.getRow();
  return studentObject_(sheet.getRange(rowNumber, 1, 1, 23).getValues()[0], rowNumber);
}

function findStudentByOrder_(ss, orderNo) {
  if (!orderNo) return null;
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
  const lastRow = sheet.getLastRow();
  if (lastRow < RSEDU_ACADEMY.DATA_START_ROW) return null;
  const range = sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW, RSEDU_ACADEMY.STUDENT.ORDER_NO, lastRow - RSEDU_ACADEMY.HEADER_ROW, 1);
  const cell = range.createTextFinder(String(orderNo)).matchEntireCell(true).findNext();
  if (!cell) return null;
  const rowNumber = cell.getRow();
  return studentObject_(sheet.getRange(rowNumber, 1, 1, 23).getValues()[0], rowNumber);
}

function studentObject_(row, rowNumber) {
  return {
    row: rowNumber,
    id: String(row[RSEDU_ACADEMY.STUDENT.ID - 1] || ''),
    appliedAt: row[RSEDU_ACADEMY.STUDENT.APPLIED_AT - 1],
    courseId: String(row[RSEDU_ACADEMY.STUDENT.COURSE_ID - 1] || ''),
    orderNo: String(row[RSEDU_ACADEMY.STUDENT.ORDER_NO - 1] || ''),
    channel: String(row[RSEDU_ACADEMY.STUDENT.CHANNEL - 1] || ''),
    buyerName: String(row[RSEDU_ACADEMY.STUDENT.BUYER_NAME - 1] || ''),
    studentName: String(row[RSEDU_ACADEMY.STUDENT.STUDENT_NAME - 1] || ''),
    email: normalizeEmail_(row[RSEDU_ACADEMY.STUDENT.EMAIL - 1]),
    phone: String(row[RSEDU_ACADEMY.STUDENT.PHONE - 1] || ''),
    paymentStatus: String(row[RSEDU_ACADEMY.STUDENT.PAYMENT_STATUS - 1] || ''),
    paymentAt: row[RSEDU_ACADEMY.STUDENT.PAYMENT_AT - 1],
    codeHint: String(row[RSEDU_ACADEMY.STUDENT.CODE_HINT - 1] || ''),
    codeHash: String(row[RSEDU_ACADEMY.STUDENT.CODE_HASH - 1] || ''),
    accessExpiresAt: row[RSEDU_ACADEMY.STUDENT.ACCESS_EXPIRES_AT - 1],
    accessStatus: String(row[RSEDU_ACADEMY.STUDENT.ACCESS_STATUS - 1] || ''),
    mailStatus: String(row[RSEDU_ACADEMY.STUDENT.MAIL_STATUS - 1] || '')
  };
}

function expireStudent_(ss, rowNumber) {
  ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS).getRange(rowNumber, RSEDU_ACADEMY.STUDENT.ACCESS_STATUS).setValue('만료');
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || RSEDU_ACADEMY.DEFAULT_SPREADSHEET_ID;
  return SpreadsheetApp.openById(id);
}

function getCourseSettings_(ss, courseId) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.COURSES);
  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW, 1, Math.max(lastRow - RSEDU_ACADEMY.HEADER_ROW, 1), 10).getValues();
  for (let i = 0; i < values.length; i += 1) {
    const row = values[i];
    if (String(row[0]) === String(courseId)) {
      return {
        row: RSEDU_ACADEMY.DATA_START_ROW + i,
        courseId: String(row[0]),
        courseName: String(row[1]),
        entryUrl: String(row[2]),
        formUrl: String(row[3] || ''),
        accessDays: Number(row[4] || 180),
        senderName: String(row[5] || 'RS에듀컨설팅 LMC Academy'),
        replyEmail: normalizeEmail_(row[6]),
        mediaProvider: String(row[7] || 'R2'),
        accessPolicy: String(row[8] || 'PRIVATE_WORKER_SIGNED_URL'),
        status: String(row[9] || '준비중')
      };
    }
  }
  throw new Error(`과정설정에서 과정코드 ${courseId}를 찾지 못했습니다.`);
}

function getSettingValue_(ss, key) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.SETTINGS);
  const lastRow = sheet.getLastRow();
  if (lastRow < RSEDU_ACADEMY.DATA_START_ROW) return '';
  const values = sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW, 1, lastRow - RSEDU_ACADEMY.HEADER_ROW, 2).getValues();
  for (let i = 0; i < values.length; i += 1) if (String(values[i][0]) === key) return values[i][1];
  return '';
}

function setSettingValue_(ss, key, value) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.SETTINGS);
  const lastRow = sheet.getLastRow();
  const values = lastRow >= RSEDU_ACADEMY.DATA_START_ROW
    ? sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW, 1, lastRow - RSEDU_ACADEMY.HEADER_ROW, 2).getValues()
    : [];
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === key) {
      sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW + i, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value, 'Apps Script 자동 기록', '운영']);
}

function validateRequiredSheets_(ss) {
  Object.keys(RSEDU_ACADEMY.SHEETS).forEach(function(key) {
    const name = RSEDU_ACADEMY.SHEETS[key];
    if (!ss.getSheetByName(name)) throw new Error(`필수 시트가 없습니다: ${name}`);
  });
}

function updateInstallStatus_(ss, step, status) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.INSTALL);
  const lastRow = sheet.getLastRow();
  if (lastRow < RSEDU_ACADEMY.DATA_START_ROW) return;
  const values = sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW, 1, lastRow - RSEDU_ACADEMY.HEADER_ROW, 1).getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (Number(values[i][0]) === Number(step)) {
      sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW + i, 6).setValue(status);
      return;
    }
  }
}

function responseMap_(formResponse) {
  const map = {};
  formResponse.getItemResponses().forEach(function(itemResponse) {
    map[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  });
  return map;
}

function answerByAliases_(answers, aliases) {
  for (let i = 0; i < aliases.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(answers, aliases[i])) return answers[aliases[i]];
  }
  const keys = Object.keys(answers);
  for (let i = 0; i < aliases.length; i += 1) {
    const token = aliases[i].replace(/[.\s·]/g, '');
    const match = keys.find(function(key) { return key.replace(/[.\s·]/g, '').indexOf(token) >= 0; });
    if (match) return answers[match];
  }
  return '';
}

function selectedStudentRow_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || getSpreadsheet_();
  const sheet = ss.getActiveSheet();
  const range = sheet.getActiveRange();
  if (sheet.getName() !== RSEDU_ACADEMY.SHEETS.STUDENTS || !range || range.getRow() < RSEDU_ACADEMY.DATA_START_ROW) {
    throw new Error('수강생 시트에서 처리할 수강생 행을 선택해 주세요.');
  }
  return { ss: ss, sheet: sheet, row: range.getRow() };
}

function runAcademySelfTest() {
  const ss = getSpreadsheet_();
  const checks = [];
  try { validateRequiredSheets_(ss); checks.push('필수 시트: 정상'); } catch (error) { checks.push('필수 시트: 실패 · ' + error.message); }
  try {
    const course = getCourseSettings_(ss, RSEDU_ACADEMY.DEFAULT_COURSE_ID);
    checks.push(`과정설정: 정상 · ${course.courseName}`);
    checks.push('영상방식: Cloudflare R2 비공개 Worker 게이트');
  } catch (error) { checks.push('과정설정: 실패 · ' + error.message); }

  const props = PropertiesService.getScriptProperties();
  checks.push(props.getProperty('FORM_ID') ? 'Google Form: 생성됨' : 'Google Form: 미생성');
  checks.push(ScriptApp.getService().getUrl() ? '웹앱 배포: URL 확인됨' : '웹앱 배포: 미완료');
  checks.push(`자동화 트리거: ${ScriptApp.getProjectTriggers().length}개`);
  const message = checks.join('\n');
  console.log(message);
  showUiMessage_('LMC 자동화 자체점검', message);
  return checks;
}

function writeLog_(ss, studentId, orderNo, email, template, result, error, retryCount) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.LOGS);
  sheet.appendRow([
    createId_('LOG'),
    new Date(),
    studentId || '',
    orderNo || '',
    email || '',
    template || '',
    result || '',
    error || '',
    Number(retryCount || 0)
  ]);
}

function enforceLoginRateLimit_(email) {
  const ss = getSpreadsheet_();
  const limit = Number(getSettingValue_(ss, 'FAIL_LIMIT') || 5);
  const cache = CacheService.getScriptCache();
  const key = 'login:' + sha256_(email).slice(0, 32);
  const count = Number(cache.get(key) || 0);
  if (count >= limit) throw new Error('RATE_LIMIT');
  cache.put(key, String(count + 1), 600);
}

function clearLoginRateLimit_(email) {
  CacheService.getScriptCache().remove('login:' + sha256_(email).slice(0, 32));
}

function hashAccessCode_(email, courseId, code) {
  return hmacSha256_([normalizeEmail_(email), String(courseId), normalizeCode_(code)].join('|'), getRequiredProperty_('CODE_PEPPER'));
}

function hashSessionToken_(token) {
  return hmacSha256_(String(token), getRequiredProperty_('SESSION_PEPPER'));
}

function ensureSecretProperty_(key) {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(key)) props.setProperty(key, randomToken_() + randomToken_());
}

function getRequiredProperty_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) throw new Error(`Script Property가 없습니다: ${key}. setupAcademyAutomation()을 먼저 실행하세요.`);
  return value;
}

function generateAccessCode_() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${Utilities.getUuid()}|${Date.now()}|${Math.random()}`, Utilities.Charset.UTF_8);
  let code = '';
  for (let i = 0; i < 8; i += 1) code += alphabet.charAt((bytes[i] + 256) % alphabet.length);
  return code;
}

function randomToken_() {
  return [Utilities.getUuid(), Utilities.getUuid(), Utilities.getUuid()].join('').replace(/-/g, '');
}

function hmacSha256_(value, key) {
  const bytes = Utilities.computeHmacSha256Signature(String(value), String(key), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function sha256_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function constantTimeEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) diff |= (a.charCodeAt(i % Math.max(a.length, 1)) || 0) ^ (b.charCodeAt(i % Math.max(b.length, 1)) || 0);
  return diff === 0;
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  const callbackName = String(callback || '');
  if (/^[A-Za-z_$][0-9A-Za-z_$.]{0,90}$/.test(callbackName)) {
    return ContentService.createTextOutput(`${callbackName}(${json});`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function publicErrorMessage_(error) {
  const code = String(error && error.message ? error.message : error);
  if (code === 'INVALID_CREDENTIALS') return '이메일 또는 입장코드가 일치하지 않습니다.';
  if (code === 'RATE_LIMIT') return '입력 횟수가 초과되었습니다. 10분 후 다시 시도해 주세요.';
  if (code === 'ACCESS_EXPIRED') return '수강기간이 만료되었습니다. 운영자에게 문의해 주세요.';
  if (code === 'ACCESS_INACTIVE') return '현재 수강권한이 활성 상태가 아닙니다.';
  if (code === 'SESSION_INVALID' || code === 'SESSION_EXPIRED') return '로그인 시간이 만료되었습니다. 다시 입장해 주세요.';
  if (/Unauthorized/.test(code)) return '인증되지 않은 요청입니다.';
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도하거나 운영자에게 문의해 주세요.';
}

function cleanText_(value) {
  if (Array.isArray(value)) return value.join(', ').trim();
  return String(value == null ? '' : value).trim();
}

function normalizeEmail_(value) { return cleanText_(value).toLowerCase(); }
function normalizeCode_(value) { return cleanText_(value).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function normalizeOrderNo_(value) { return cleanText_(value).replace(/\s+/g, ''); }
function normalizePhone_(value) { return cleanText_(value).replace(/[^0-9+\-]/g, ''); }
function isValidEmail_(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')); }
function createId_(prefix) { return `${prefix}-${Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMddHHmmss')}-${Utilities.getUuid().slice(0, 8).toUpperCase()}`; }
function escapeHtml_(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }

function showUiMessage_(title, message) {
  try { SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK); }
  catch (error) { console.log(`${title}: ${message}`); }
}
