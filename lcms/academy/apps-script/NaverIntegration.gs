/** Server-only bridge. No raw code, registration token or secret is stored here. */
const LMC_NAVER_SHEET = '네이버연동';
var LMC_NAVER_MUTATION_CONTEXT = false;

function setupNaverIntegration() {
  const ss = getSpreadsheet_();
  if (!ss.getSheetByName(LMC_NAVER_SHEET)) {
    const sheet = ss.insertSheet(LMC_NAVER_SHEET);
    sheet.getRange(1, 1).setValue('LMC NAVER integration ledger v1');
    sheet.getRange(2, 1, 1, 8).setValues([['PRODUCT_ORDER_ID', 'COURSE_ID', 'STUDENT_ID', 'TERMINAL_STATUS', 'ISSUE_ATTEMPTED', 'STATE', 'UPDATED_AT', 'OPERATIONS_JSON']]);
  }
  ensureSecretProperty_('NAVER_SHARED_SECRET');
  const props = PropertiesService.getScriptProperties();
  ['NAVER_AUTO_PROVISION_ENABLED', 'NAVER_AUTO_SUSPEND_ENABLED'].forEach(function(key) {
    if (!props.getProperty(key)) props.setProperty(key, 'false');
  });
  if (!props.getProperty('NAVER_DRY_RUN')) props.setProperty('NAVER_DRY_RUN', 'true');
  if (!ScriptApp.getProjectTriggers().some(function(t) { return t.getHandlerFunction() === 'purgeNaverContactData'; })) {
    ScriptApp.newTrigger('purgeNaverContactData').timeBased().atHour(4).everyDays(1).create();
  }
  return { ok: true, sheet: LMC_NAVER_SHEET };
}

function naverIntegrationResponse_(envelope) {
  try {
    const action = String(envelope.action || '');
    const timestamp = Number(envelope.timestamp);
    const body = String(envelope.body || '');
    const secret = getRequiredProperty_('NAVER_SHARED_SECRET');
    if (secret.length < 32 || !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 300000 || body.length > 8192 ||
        !constantTimeEqual_(String(envelope.signature || ''), hmacSha256_(action + '\n' + timestamp + '\n' + body, secret))) throw new Error('NAVER_UNAUTHORIZED');
    const payload = JSON.parse(body);
    const result = naverDispatch_(action.toLowerCase(), payload);
    return { ok: true, result: result };
  } catch (error) {
    // Never echo user input or upstream exception messages into API/logs.
    return { ok: false, message: 'NAVER_REQUEST_REJECTED' };
  }
}

function naverLedger_(ss, orderNo, create) {
  const sheet = ss.getSheetByName(LMC_NAVER_SHEET);
  if (!sheet) throw new Error('NAVER_SETUP_REQUIRED');
  const count = Math.max(0, sheet.getLastRow() - 2);
  const rows = count ? sheet.getRange(3, 1, count, 8).getValues() : [];
  const matches = rows.map(function(values, i) { return { values: values, row: i + 3 }; }).filter(function(item) { return String(item.values[0]) === orderNo; });
  if (matches.length > 1) throw new Error('NAVER_LEDGER_CONFLICT');
  if (matches.length) return matches[0];
  if (!create) return null;
  return { row: Math.max(sheet.getLastRow() + 1, 3), values: [orderNo, RSEDU_ACADEMY.DEFAULT_COURSE_ID, '', '', '', 'NAVER_DETECTED', new Date(), '{}'] };
}

function naverSaveLedger_(ss, ledger) {
  ledger.values[6] = new Date();
  ss.getSheetByName(LMC_NAVER_SHEET).getRange(ledger.row, 1, 1, 8).setValues([ledger.values]);
  SpreadsheetApp.flush();
}

function naverEnsureOrderNotRevoked_(ss, orderNo) {
  if (!ss.getSheetByName(LMC_NAVER_SHEET)) return;
  const ledger = naverLedger_(ss, String(orderNo), false);
  if (ledger && ledger.values[3]) throw new Error('취소 또는 정지된 주문은 재발급할 수 없습니다.');
}

function naverStudents_(ss, orderNo) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
  const count = Math.max(0, sheet.getLastRow() - RSEDU_ACADEMY.HEADER_ROW);
  return (count ? sheet.getRange(3, 1, count, 23).getValues() : []).map(function(row, i) { return studentObject_(row, i + 3); })
    .filter(function(s) { return s.orderNo === orderNo; });
}

function naverResult_(ss, ledger, student) {
  let state = String(ledger.values[5]);
  if (student) {
    if (student.accessStatus === '정지' || student.accessStatus === '만료') state = 'SUSPENDED';
    else if (student.accessStatus === '활성' && student.mailStatus === '발송완료') state = 'ACTIVE';
    else if (ledger.values[4]) state = 'MANUAL_REVIEW';
  } else if (ledger.values[4]) state = 'MANUAL_REVIEW';
  if (ledger.values[3]) state = student && student.accessStatus === '정지' ? 'SUSPENDED' : String(ledger.values[3]);
  return { state: state, studentId: student ? student.id : '', accessStatus: student ? student.accessStatus : '', mailStatus: student ? student.mailStatus : '', error: state === 'MANUAL_REVIEW' ? 'ISSUANCE_REVIEW_REQUIRED' : '' };
}

function naverDispatch_(action, payload) {
  if (['naverregister', 'naversuspend', 'naverorderstatus', 'naverreissue'].indexOf(action) < 0) throw new Error('UNSUPPORTED_ACTION');
  const orderNo = String(payload.productOrderId || '');
  if (!/^\d{8,30}$/.test(orderNo) || payload.courseId !== RSEDU_ACADEMY.DEFAULT_COURSE_ID) throw new Error('INVALID_ORDER');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    LMC_NAVER_MUTATION_CONTEXT = true;
    const ss = getSpreadsheet_(), props = PropertiesService.getScriptProperties();
    const ledger = naverLedger_(ss, orderNo, true);
    const matches = naverStudents_(ss, orderNo);
    if (matches.length > 1 || (matches[0] && matches[0].courseId !== payload.courseId)) {
      // Fail closed; revoke all matching LMC rows on terminal events.
      if (action === 'naversuspend' && props.getProperty('NAVER_AUTO_SUSPEND_ENABLED') === 'true' && props.getProperty('NAVER_DRY_RUN') === 'false') {
        if (['CANCELED', 'RETURNED', 'CANCELED_BY_NOPAYMENT', 'ADMIN_SUSPEND'].indexOf(payload.naverStatus) < 0) throw new Error('INVALID_STATUS');
        ledger.values[3] = ledger.values[3] || payload.naverStatus;
        naverSaveLedger_(ss, ledger);
        matches.filter(function(s) { return s.courseId === payload.courseId; }).forEach(function(s) { suspendStudentRow_(ss, s.row, 'NAVER_ORDER_CONFLICT', true); });
      }
      ledger.values[5] = 'MANUAL_REVIEW'; naverSaveLedger_(ss, ledger);
      return { state: 'MANUAL_REVIEW', error: 'LEGACY_ORDER_CONFLICT' };
    }
    let student = matches[0] || null;
    if (student) ledger.values[2] = student.id;
    if (action === 'naverorderstatus') return naverResult_(ss, ledger, student);

    if (props.getProperty('NAVER_DRY_RUN') !== 'false') throw new Error('NAVER_DISABLED');
    if (action === 'naversuspend') {
      if (props.getProperty('NAVER_AUTO_SUSPEND_ENABLED') !== 'true' || ['CANCELED', 'RETURNED', 'CANCELED_BY_NOPAYMENT', 'ADMIN_SUSPEND'].indexOf(payload.naverStatus) < 0) throw new Error('NAVER_DISABLED');
      ledger.values[3] = ledger.values[3] || payload.naverStatus;
      ledger.values[5] = ledger.values[3];
      naverSaveLedger_(ss, ledger); // tombstone before any downstream mutation
      if (student) {
        const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
        sheet.getRange(student.row, RSEDU_ACADEMY.STUDENT.PAYMENT_STATUS).setValue(payload.naverStatus === 'RETURNED' ? '환불' : '취소');
        if (student.accessStatus !== '정지') suspendStudentRow_(ss, student.row, 'NAVER_' + payload.naverStatus, true);
        student = findStudentById_(ss, student.id);
      }
      return naverResult_(ss, ledger, student);
    }
    if (props.getProperty('NAVER_AUTO_PROVISION_ENABLED') !== 'true' || ledger.values[3]) throw new Error('NAVER_DISABLED');

    if (action === 'naverreissue') {
      const operationId = String(payload.operationId || '');
      if (!/^[a-f0-9-]{36}$/.test(operationId) || !student) throw new Error('REISSUE_INVALID');
      const operations = JSON.parse(ledger.values[7] || '{}');
      if (Object.prototype.hasOwnProperty.call(operations, operationId)) return naverResult_(ss, ledger, student);
      if (Object.keys(operations).length >= 100) throw new Error('REISSUE_LIMIT');
      // Existing expiry policy is authoritative, also when prior mail failed.
      resolveProvisioningExpiry_(student, Date.now(), RSEDU_ACADEMY.ACCESS_DAYS, true);
      operations[operationId] = 'ATTEMPTED'; ledger.values[7] = JSON.stringify(operations);
      ledger.values[4] = 'ATTEMPTED'; ledger.values[5] = 'PROVISIONED'; naverSaveLedger_(ss, ledger);
      try { provisionStudentRow_(ss, student.row, { forceNewCode: true, source: 'NAVER_ADMIN_REISSUE', lockHeld: true }); }
      catch (error) { ledger.values[5] = 'MANUAL_REVIEW'; naverSaveLedger_(ss, ledger); }
      return naverResult_(ss, ledger, findStudentById_(ss, student.id));
    }

    if (['PAYED', 'DELIVERING', 'DELIVERED', 'PURCHASE_DECIDED'].indexOf(payload.naverStatus) < 0 || payload.quantity !== 1 || payload.consent !== true || payload.consentVersion !== 'lmc-registration-v1') throw new Error('INVALID_REGISTRATION');
    const email = normalizeEmail_(payload.email), studentName = cleanText_(payload.studentName), phone = normalizePhone_(payload.phone);
    if (!isValidEmail_(email) || email.length > 254 || !studentName || studentName.length > 80 || !/^01\d{8,9}$/.test(phone)) throw new Error('INVALID_STUDENT');
    if (student && (student.email !== email || student.studentName !== studentName || student.phone.replace(/\D/g, '') !== phone)) {
      return { state: 'MANUAL_REVIEW', error: 'LEGACY_IDENTITY_CONFLICT' };
    }
    if (ledger.values[4] || (student && (student.codeHash || student.codeIssuedAt || student.accessStatus === '정지' || student.accessStatus === '만료'))) {
      return naverResult_(ss, ledger, student);
    }
    if (!student) {
      // Avoid making a second active term for the same email/course.
      if (findActiveStudent_(ss, email, payload.courseId)) return { state: 'MANUAL_REVIEW', error: 'ACTIVE_ENROLLMENT_EXISTS' };
      const row = new Array(23).fill(''), col = RSEDU_ACADEMY.STUDENT;
      row[col.ID - 1] = createId_('REG'); row[col.APPLIED_AT - 1] = new Date(); row[col.COURSE_ID - 1] = payload.courseId;
      row[col.ORDER_NO - 1] = sheetSafeText_(orderNo); row[col.CHANNEL - 1] = '스마트스토어';
      row[col.STUDENT_NAME - 1] = sheetSafeText_(studentName); row[col.EMAIL - 1] = sheetSafeText_(email); row[col.PHONE - 1] = sheetSafeText_(phone);
      row[col.CONSENT - 1] = '동의 lmc-registration-v1'; row[col.PAYMENT_STATUS - 1] = '확인완료'; row[col.PAYMENT_AT - 1] = new Date();
      row[col.ACCESS_STATUS - 1] = '대기'; row[col.MAIL_STATUS - 1] = '미발송'; row[col.NOTE - 1] = 'NAVER_REGISTRATION_V1';
      const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS), target = Math.max(3, sheet.getLastRow() + 1);
      sheet.getRange(target, 1, 1, 23).setValues([row]); SpreadsheetApp.flush();
      student = studentObject_(row, target);
    } else {
      // A matching legacy Form row may be claimed; its information is not replaced.
      ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS).getRange(student.row, RSEDU_ACADEMY.STUDENT.PAYMENT_STATUS).setValue('확인완료');
      ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS).getRange(student.row, RSEDU_ACADEMY.STUDENT.PAYMENT_AT).setValue(new Date());
    }
    ledger.values[2] = student.id;
    ledger.values[4] = 'ATTEMPTED'; ledger.values[5] = 'PROVISIONED';
    naverSaveLedger_(ss, ledger); // at-most-once issuance across timeouts/crashes
    try { provisionStudentRow_(ss, student.row, { forceNewCode: false, source: 'NAVER_REGISTER', lockHeld: true }); }
    catch (error) { ledger.values[5] = 'MANUAL_REVIEW'; naverSaveLedger_(ss, ledger); }
    return naverResult_(ss, ledger, findStudentById_(ss, student.id));
  } finally { LMC_NAVER_MUTATION_CONTEXT = false; lock.releaseLock(); }
}

/** New registrations only. Legacy/Form rows are never migrated or purged here. */
function purgeNaverContactData() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss = getSpreadsheet_(), sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
    const count = Math.max(0, sheet.getLastRow() - 2), now = Date.now(), col = RSEDU_ACADEMY.STUDENT;
    const rows = count ? sheet.getRange(3, 1, count, 23).getValues() : [];
    rows.forEach(function(values, i) {
      if (values[col.CONSENT - 1] !== '동의 lmc-registration-v1') return;
      const student = studentObject_(values, i + 3), expiry = timestampMs_(student.accessExpiresAt);
      // 180-day term plus 30-day support period; unfinished issuance uses appliedAt.
      const cutoff = Number.isFinite(expiry) ? expiry : timestampMs_(student.appliedAt) + 180 * 86400000;
      if (!Number.isFinite(cutoff) || now <= cutoff + 30 * 86400000) return;
      if (student.accessStatus === '활성') expireStudentRow_(ss, student.row, '수강기간 만료');
      sheet.getRange(student.row, col.BUYER_NAME, 1, 4).clearContent();
      sheet.getRange(student.row, col.CODE_HINT, 1, 2).clearContent();
      sheet.getRange(student.row, col.ERROR).clearContent();
      sheet.getRange(student.row, col.CONSENT).setValue('삭제완료 lmc-registration-v1');
      const logs = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.LOGS), n = Math.max(0, logs.getLastRow() - 2);
      if (n) logs.getRange(3, 1, n, 9).getValues().forEach(function(log, j) {
        if (String(log[2]) === student.id) { logs.getRange(j + 3, 5).clearContent(); logs.getRange(j + 3, 8).clearContent(); }
      });
    });
  } finally { lock.releaseLock(); }
}
