/** 강의실 웹앱 API와 세션 */

function doGet(event) {
  const params = event && event.parameter ? event.parameter : {};
  const action = String(params.action || 'health').toLowerCase();
  try {
    if (action !== 'health') throw new Error('UNSUPPORTED_ACTION');
    return jsonOutput_(Object.assign({ ok: true }, healthResponse_()));
  } catch (error) {
    console.warn('[LMC Academy API]', action, error);
    return jsonOutput_({ ok: false, message: publicErrorMessage_(error) });
  }
}

/**
 * Cloudflare Worker-to-Apps-Script API.
 *
 * - login / validate / logout: Worker /access browser-auth proxy
 * - workerValidate: Cloudflare Worker session validation
 * - confirmPayment: Future SmartStore/Naver Commerce sync hook
 *
 * Keep WORKER_SHARED_SECRET and SYNC_SECRET in Script Properties only.
 */
function doPost(event) {
  let action = '';
  try {
    const payload = JSON.parse(event && event.postData && event.postData.contents ? event.postData.contents : '{}');
    action = String(payload.action || '').trim().toLowerCase();

    if (action === 'login' || action === 'validate' || action === 'logout') {
      requireWorkerSharedSecret_(payload);
      const result = action === 'login'
        ? loginResponse_(payload)
        : (action === 'validate' ? validateResponse_(payload) : logoutResponse_(payload));
      return jsonOutput_(Object.assign({ ok: true }, result));
    }

    if (action === 'workervalidate') {
      const validation = workerValidateResponse_(payload);
      return jsonOutput_(Object.assign({ ok: true }, validation));
    }

    if (action === 'confirmpayment') {
      if (!constantTimeEqual_(String(payload.secret || ''), getRequiredProperty_('SYNC_SECRET'))) {
        throw new Error('WEBHOOK_UNAUTHORIZED');
      }
      const result = confirmPaymentByOrder_(String(payload.orderNo || ''), 'WEBHOOK');
      return jsonOutput_({ ok: true, result: result });
    }

    throw new Error('UNSUPPORTED_ACTION');
  } catch (error) {
    console.warn('[LMC Academy server API]', action || 'unknown', String(error && error.message ? error.message : error));
    const response = { ok: false, message: publicErrorMessage_(error) };
    if (action === 'workervalidate') response.valid = false;
    return jsonOutput_(response);
  }
}

function requireWorkerSharedSecret_(payload) {
  const suppliedSecret = String(payload && payload.workerSecret ? payload.workerSecret : '');
  const expectedSecret = getRequiredProperty_('WORKER_SHARED_SECRET');
  if (expectedSecret.length < 32) throw new Error('WORKER_SECRET_MISCONFIGURED');
  if (!constantTimeEqual_(suppliedSecret, expectedSecret)) throw new Error('WORKER_UNAUTHORIZED');
}

function loginResponse_(params) {
  const email = normalizeEmail_(params.email);
  const code = normalizeCode_(params.code);
  const courseId = cleanText_(params.courseId) || RSEDU_ACADEMY.DEFAULT_COURSE_ID;
  const userAgent = normalizeUserAgent_(params.ua);
  if (courseId !== RSEDU_ACADEMY.DEFAULT_COURSE_ID || !isValidEmail_(email) || code.length !== 8 || !userAgent) {
    throw new Error('INVALID_CREDENTIALS');
  }
  enforceLoginRateLimit_(email);

  const ss = getSpreadsheet_();
  const student = findActiveStudent_(ss, email, courseId);
  const expected = student ? student.codeHash : hashAccessCode_(email, courseId, 'INVALID00');
  const actual = hashAccessCode_(email, courseId, code);
  if (!student || !constantTimeEqual_(expected, actual)) throw new Error('INVALID_CREDENTIALS');
  const accessExpiresAt = timestampMs_(student.accessExpiresAt);
  if (!Number.isFinite(accessExpiresAt)) throw new Error('ACCESS_INACTIVE');
  if (accessExpiresAt <= Date.now()) {
    expireStudentRow_(ss, student.row, '로그인 시 수강기간 만료 확인');
    throw new Error('ACCESS_EXPIRED');
  }

  const session = createSession_(ss, student, userAgent);
  clearLoginRateLimit_(email);
  return {
    token: session.token,
    studentId: student.id,
    studentName: student.studentName,
    courseId: student.courseId,
    expiresAt: session.expiresAt.toISOString()
  };
}

function validateResponse_(params) {
  const access = validateSessionAccess_(
    String(params.token || '').trim(),
    cleanText_(params.courseId),
    normalizeUserAgent_(params.ua)
  );
  return {
    studentId: access.student.id,
    studentName: access.student.studentName,
    courseId: access.student.courseId,
    expiresAt: access.expiresAt.toISOString()
  };
}

function workerValidateResponse_(payload) {
  requireWorkerSharedSecret_(payload);

  try {
    const access = validateSessionAccess_(
      String(payload.token || '').trim(),
      cleanText_(payload.courseId),
      normalizeUserAgent_(payload.userAgent)
    );
    return {
      valid: true,
      studentId: access.student.id,
      studentName: access.student.studentName,
      courseId: access.student.courseId,
      expiresAt: access.expiresAt.toISOString()
    };
  } catch (error) {
    if (isAccessDenialError_(error)) return { valid: false };
    throw error;
  }
}

/**
 * Validates and touches one session. Both the browser validation endpoint and
 * the Worker server-to-server endpoint use this exact path.
 */
function validateSessionAccess_(rawToken, requestedCourseId, userAgent) {
  if (String(rawToken || '').length < 32) throw new Error('SESSION_INVALID');

  const ss = getSpreadsheet_();
  const session = findSession_(ss, rawToken);
  const student = session ? findStudentById_(ss, session.studentId) : null;
  const suppliedUserAgentHash = userAgent ? userAgentHash_(userAgent) : '';
  const now = Date.now();
  const state = evaluateSessionAccessState_(
    session,
    student,
    requestedCourseId,
    suppliedUserAgentHash,
    now
  );

  if (!state.valid) {
    if (session && session.row && state.code === 'SESSION_EXPIRED') {
      updateSessionStatus_(ss, session.row, '만료');
    } else if (student && student.row && state.code === 'ACCESS_EXPIRED') {
      expireStudentRow_(ss, student.row, '세션 확인 시 수강기간 만료');
    } else if (session && session.row && (state.code === 'ACCESS_INACTIVE' || state.code === 'STUDENT_NOT_FOUND')) {
      updateSessionStatus_(ss, session.row, '종료');
    }
    throw new Error(state.code);
  }

  const checkedAt = new Date(now);
  const sessionSheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.SESSIONS);
  sessionSheet.getRange(session.row, RSEDU_ACADEMY.SESSION.LAST_CHECKED_AT).setValue(checkedAt);
  const studentSheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
  studentSheet.getRange(student.row, RSEDU_ACADEMY.STUDENT.LAST_ACCESS_AT).setValue(checkedAt);
  return {
    session: session,
    student: student,
    expiresAt: new Date(state.expiresAt)
  };
}

/**
 * Pure, deterministic access decision helper. It intentionally performs no
 * Sheet or Property writes so the complete deny matrix can be tested locally.
 */
function evaluateSessionAccessState_(session, student, requestedCourseId, suppliedUserAgentHash, nowMs) {
  const now = Number(nowMs);
  if (!session || session.status !== '활성') return { valid: false, code: 'SESSION_INVALID' };

  const sessionExpiresAt = timestampMs_(session.expiresAt);
  if (!Number.isFinite(sessionExpiresAt) || sessionExpiresAt <= now) {
    return { valid: false, code: 'SESSION_EXPIRED' };
  }

  const courseId = String(requestedCourseId || '');
  if (
    courseId !== RSEDU_ACADEMY.DEFAULT_COURSE_ID ||
    String(session.courseId || '') !== courseId
  ) {
    return { valid: false, code: 'COURSE_MISMATCH' };
  }

  if (!student) return { valid: false, code: 'STUDENT_NOT_FOUND' };
  if (String(student.courseId || '') !== courseId) return { valid: false, code: 'COURSE_MISMATCH' };
  if (student.paymentStatus !== '확인완료' || student.accessStatus !== '활성') {
    return { valid: false, code: 'ACCESS_INACTIVE' };
  }

  const accessExpiresAt = timestampMs_(student.accessExpiresAt);
  if (!Number.isFinite(accessExpiresAt)) return { valid: false, code: 'ACCESS_INACTIVE' };
  if (accessExpiresAt <= now) return { valid: false, code: 'ACCESS_EXPIRED' };

  if (
    !session.userAgentHash ||
    !suppliedUserAgentHash ||
    !constantTimeEqual_(session.userAgentHash, suppliedUserAgentHash)
  ) {
    return { valid: false, code: 'USER_AGENT_MISMATCH' };
  }

  return {
    valid: true,
    code: '',
    expiresAt: Math.min(sessionExpiresAt, accessExpiresAt)
  };
}

function isAccessDenialError_(error) {
  const code = String(error && error.message ? error.message : error);
  return [
    'SESSION_INVALID',
    'SESSION_EXPIRED',
    'COURSE_MISMATCH',
    'STUDENT_NOT_FOUND',
    'ACCESS_INACTIVE',
    'ACCESS_EXPIRED',
    'USER_AGENT_MISMATCH'
  ].indexOf(code) >= 0;
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
    playbackMode: 'CLOUDFLARE_R2_WORKER',
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
  const configuredHours = Number(getSettingValue_(ss, 'SESSION_HOURS') || RSEDU_ACADEMY.SESSION_HOURS);
  const hours = Number.isFinite(configuredHours) && configuredHours > 0
    ? Math.min(configuredHours, RSEDU_ACADEMY.SESSION_HOURS)
    : RSEDU_ACADEMY.SESSION_HOURS;
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
    userAgentHash_(userAgent),
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
    status: String(row[7] || ''),
    userAgentHash: String(row[8] || '')
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
