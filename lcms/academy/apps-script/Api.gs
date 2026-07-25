/** 강의실 웹앱 API와 세션 */

function doGet(event) {
  const params = event && event.parameter ? event.parameter : {};
  const action = String(params.action || 'health').toLowerCase();
  try {
    let result;
    if (action === 'health') result = healthResponse_();
    else if (action === 'login') result = loginResponse_(params);
    else if (action === 'validate') result = validateResponse_(params);
    else if (action === 'logout') result = logoutResponse_(params);
    else throw new Error('지원하지 않는 요청입니다.');
    return output_(Object.assign({ ok: true }, result), params.callback);
  } catch (error) {
    console.warn('[LMC Academy API]', action, error);
    return output_({ ok: false, message: publicErrorMessage_(error) }, params.callback);
  }
}

/** Future SmartStore/Naver Commerce sync hook. Keep SYNC_SECRET in Script Properties. */
function doPost(event) {
  try {
    const payload = JSON.parse(event && event.postData && event.postData.contents ? event.postData.contents : '{}');
    if (!constantTimeEqual_(String(payload.secret || ''), getRequiredProperty_('SYNC_SECRET'))) {
      throw new Error('Unauthorized webhook');
    }
    if (String(payload.action || '') !== 'confirmPayment') throw new Error('Unsupported webhook action');
    const result = confirmPaymentByOrder_(String(payload.orderNo || ''), 'WEBHOOK');
    return ContentService.createTextOutput(JSON.stringify({ ok: true, result: result })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, message: publicErrorMessage_(error) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function loginResponse_(params) {
  const email = normalizeEmail_(params.email);
  const code = normalizeCode_(params.code);
  const courseId = cleanText_(params.courseId) || RSEDU_ACADEMY.DEFAULT_COURSE_ID;
  if (!isValidEmail_(email) || code.length !== 8) throw new Error('INVALID_CREDENTIALS');
  enforceLoginRateLimit_(email);

  const ss = getSpreadsheet_();
  const student = findActiveStudent_(ss, email, courseId);
  const expected = student ? student.codeHash : hashAccessCode_(email, courseId, 'INVALID00');
  const actual = hashAccessCode_(email, courseId, code);
  if (!student || !constantTimeEqual_(expected, actual)) throw new Error('INVALID_CREDENTIALS');
  if (student.accessExpiresAt && new Date(student.accessExpiresAt).getTime() <= Date.now()) {
    expireStudentRow_(ss, student.row, '로그인 시 수강기간 만료 확인');
    throw new Error('ACCESS_EXPIRED');
  }

  const session = createSession_(ss, student, params.ua || '');
  clearLoginRateLimit_(email);
  return {
    token: session.token,
    studentName: student.studentName,
    courseId: student.courseId,
    expiresAt: session.expiresAt.toISOString()
  };
}

function validateResponse_(params) {
  const token = String(params.token || '').trim();
  if (token.length < 32) throw new Error('SESSION_INVALID');
  const ss = getSpreadsheet_();
  const session = findSession_(ss, token);
  if (!session || session.status !== '활성') throw new Error('SESSION_INVALID');
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    updateSessionStatus_(ss, session.row, '만료');
    throw new Error('SESSION_EXPIRED');
  }

  const student = findStudentById_(ss, session.studentId);
  if (!student || student.accessStatus !== '활성' || student.paymentStatus !== '확인완료') throw new Error('ACCESS_INACTIVE');
  if (student.accessExpiresAt && new Date(student.accessExpiresAt).getTime() <= Date.now()) {
    expireStudentRow_(ss, student.row, '세션 확인 시 수강기간 만료');
    updateSessionStatus_(ss, session.row, '만료');
    throw new Error('ACCESS_EXPIRED');
  }

  const sessionSheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.SESSIONS);
  sessionSheet.getRange(session.row, RSEDU_ACADEMY.SESSION.LAST_CHECKED_AT).setValue(new Date());
  const studentSheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
  studentSheet.getRange(student.row, RSEDU_ACADEMY.STUDENT.LAST_ACCESS_AT).setValue(new Date());
  return {
    studentName: student.studentName,
    courseId: student.courseId,
    expiresAt: new Date(session.expiresAt).toISOString()
  };
}

function logoutResponse_(params) {
  const token = String(params.token || '').trim();
  if (!token) return { loggedOut: true };
  const ss = getSpreadsheet_();
  const session = findSession_(ss, token);
  if (session) updateSessionStatus_(ss, session.row, '종료');
  return { loggedOut: true };
}

function healthResponse_() {
  const ss = getSpreadsheet_();
  const course = getCourseSettings_(ss, RSEDU_ACADEMY.DEFAULT_COURSE_ID);
  return {
    version: RSEDU_ACADEMY.VERSION,
    courseId: course.courseId,
    formReady: Boolean(PropertiesService.getScriptProperties().getProperty('FORM_ID')),
    driveReady: Boolean(course.driveFolderId),
    timestamp: new Date().toISOString()
  };
}

function confirmPaymentByOrder_(orderNo, source) {
  const ss = getSpreadsheet_();
  const student = findStudentByOrder_(ss, normalizeOrderNo_(orderNo));
  if (!student) throw new Error('상품주문번호와 일치하는 신청을 찾지 못했습니다.');
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
  sheet.getRange(student.row, RSEDU_ACADEMY.STUDENT.PAYMENT_STATUS).setValue('확인완료');
  sheet.getRange(student.row, RSEDU_ACADEMY.STUDENT.PAYMENT_AT).setValue(new Date());
  return provisionStudentRow_(ss, student.row, { forceNewCode: false, source: source || 'API' });
}

function createSession_(ss, student, userAgent) {
  const rawToken = randomToken_();
  const tokenHash = hashSessionToken_(rawToken);
  const now = new Date();
  const hours = Number(getSettingValue_(ss, 'SESSION_HOURS') || 12);
  const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
  const sessionSheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.SESSIONS);
  const row = [
    createId_('SES'),
    tokenHash,
    student.id,
    student.courseId,
    now,
    expiresAt,
    now,
    '활성',
    sha256_(String(userAgent || '').slice(0, 500)),
    '웹 로그인'
  ];
  sessionSheet.appendRow(row);

  const studentSheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
  const currentCount = Number(studentSheet.getRange(student.row, RSEDU_ACADEMY.STUDENT.ACCESS_COUNT).getValue() || 0);
  studentSheet.getRange(student.row, RSEDU_ACADEMY.STUDENT.LAST_ACCESS_AT).setValue(now);
  studentSheet.getRange(student.row, RSEDU_ACADEMY.STUDENT.ACCESS_COUNT).setValue(currentCount + 1);
  return { token: rawToken, expiresAt: expiresAt };
}

function findSession_(ss, rawToken) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.SESSIONS);
  const lastRow = sheet.getLastRow();
  if (lastRow < RSEDU_ACADEMY.DATA_START_ROW) return null;
  const hash = hashSessionToken_(rawToken);
  const range = sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW, RSEDU_ACADEMY.SESSION.TOKEN_HASH, lastRow - RSEDU_ACADEMY.HEADER_ROW, 1);
  const cell = range.createTextFinder(hash).matchEntireCell(true).findNext();
  if (!cell) return null;
  const rowNumber = cell.getRow();
  const row = sheet.getRange(rowNumber, 1, 1, 10).getValues()[0];
  return {
    row: rowNumber,
    id: row[0],
    tokenHash: row[1],
    studentId: row[2],
    courseId: row[3],
    createdAt: row[4],
    expiresAt: row[5],
    lastCheckedAt: row[6],
    status: row[7]
  };
}

function invalidateStudentSessions_(ss, studentId, note) {
  if (!studentId) return;
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.SESSIONS);
  const lastRow = sheet.getLastRow();
  if (lastRow < RSEDU_ACADEMY.DATA_START_ROW) return;
  const values = sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW, 1, lastRow - RSEDU_ACADEMY.HEADER_ROW, 10).getValues();
  values.forEach(function(row, index) {
    if (String(row[RSEDU_ACADEMY.SESSION.STUDENT_ID - 1]) === studentId && String(row[RSEDU_ACADEMY.SESSION.STATUS - 1]) === '활성') {
      const target = RSEDU_ACADEMY.DATA_START_ROW + index;
      sheet.getRange(target, RSEDU_ACADEMY.SESSION.STATUS).setValue('종료');
      sheet.getRange(target, RSEDU_ACADEMY.SESSION.NOTE).setValue(note || '세션 종료');
    }
  });
}

function updateSessionStatus_(ss, row, status) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.SESSIONS);
  sheet.getRange(row, RSEDU_ACADEMY.SESSION.STATUS).setValue(status);
  sheet.getRange(row, RSEDU_ACADEMY.SESSION.LAST_CHECKED_AT).setValue(new Date());
}
