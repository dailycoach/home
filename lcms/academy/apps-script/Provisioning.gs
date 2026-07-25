/** Cloudflare R2 강의실 입장코드 발급, 이용정지, 만료, 메일 전송 */

function provisionStudentRow_(ss, rowNumber, options) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
    const values = sheet.getRange(rowNumber, 1, 1, 23).getValues()[0];
    const student = studentObject_(values, rowNumber);
    const forceNewCode = Boolean(options && options.forceNewCode);

    if (student.paymentStatus !== '확인완료') throw new Error('결제상태가 확인완료가 아닙니다.');
    if (!student.id || !student.studentName || !isValidEmail_(student.email)) throw new Error('수강생 이름 또는 이메일이 올바르지 않습니다.');
    if (!forceNewCode && student.accessStatus === '활성' && student.codeHash && student.mailStatus === '발송완료') {
      return { ok: true, alreadyProvisioned: true, studentId: student.id, studentName: student.studentName };
    }

    const course = getCourseSettings_(ss, student.courseId || RSEDU_ACADEMY.DEFAULT_COURSE_ID);
    const code = generateAccessCode_();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + course.accessDays * 24 * 60 * 60 * 1000);
    const codeHash = hashAccessCode_(student.email, course.courseId, code);
    const codeHint = `${code.slice(0, 2)}••••${code.slice(-2)}`;

    sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.CODE_HINT).setValue(codeHint);
    sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.CODE_HASH).setValue(codeHash);
    sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.CODE_ISSUED_AT).setValue(now);
    sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.ACCESS_EXPIRES_AT).setValue(expiresAt);
    sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.ACCESS_STATUS).setValue('활성');
    sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.MAIL_STATUS).setValue('발송대기');
    sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.ERROR).clearContent();
    invalidateStudentSessions_(ss, student.id, forceNewCode ? '입장코드 재발급' : '수강권 발급');

    try {
      sendAccessEmail_(course, student, code, expiresAt);
      sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.MAIL_STATUS).setValue('발송완료');
      sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.MAIL_AT).setValue(new Date());
      writeLog_(ss, student.id, student.orderNo, student.email, forceNewCode ? 'ACCESS_REISSUE' : 'ACCESS_ISSUE', 'SUCCESS', '', 0);
    } catch (error) {
      sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.MAIL_STATUS).setValue('발송오류');
      sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.ERROR).setValue(error.message);
      writeLog_(ss, student.id, student.orderNo, student.email, forceNewCode ? 'ACCESS_REISSUE' : 'ACCESS_ISSUE', 'ERROR', error.message, 0);
      throw error;
    }

    return {
      ok: true,
      studentId: student.id,
      studentName: student.studentName,
      email: student.email,
      expiresAt: expiresAt.toISOString(),
      source: options && options.source ? options.source : 'UNKNOWN'
    };
  } finally {
    lock.releaseLock();
  }
}

function suspendStudentRow_(ss, rowNumber, reason) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
  const values = sheet.getRange(rowNumber, 1, 1, 23).getValues()[0];
  const student = studentObject_(values, rowNumber);
  invalidateStudentSessions_(ss, student.id, reason || '접근 정지');
  sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.CODE_HINT, 1, 2).clearContent();
  sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.ACCESS_STATUS).setValue('정지');
  sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.NOTE).setValue(reason || '관리자 정지');
  writeLog_(ss, student.id, student.orderNo, student.email, 'ACCESS_SUSPEND', 'SUCCESS', '', 0);
  return { ok: true, studentId: student.id, studentName: student.studentName };
}

function expireStudentRow_(ss, rowNumber, reason) {
  const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
  const values = sheet.getRange(rowNumber, 1, 1, 23).getValues()[0];
  const student = studentObject_(values, rowNumber);
  if (!student.id || student.accessStatus !== '활성') return { ok: true, skipped: true };

  invalidateStudentSessions_(ss, student.id, reason || '수강기간 만료');
  sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.CODE_HINT, 1, 2).clearContent();
  sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.ACCESS_STATUS).setValue('만료');
  sheet.getRange(rowNumber, RSEDU_ACADEMY.STUDENT.NOTE).setValue(reason || '수강기간 만료');
  writeLog_(ss, student.id, student.orderNo, student.email, 'ACCESS_EXPIRE', 'SUCCESS', '', 0);
  return { ok: true, studentId: student.id, studentName: student.studentName };
}

/** 매일 새벽 installable trigger로 만료된 입장코드와 세션을 회수합니다. */
function expireStudentAccesses() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(RSEDU_ACADEMY.SHEETS.STUDENTS);
    const lastRow = sheet.getLastRow();
    if (lastRow < RSEDU_ACADEMY.DATA_START_ROW) return { ok: true, expired: 0 };

    const values = sheet.getRange(RSEDU_ACADEMY.DATA_START_ROW, 1, lastRow - RSEDU_ACADEMY.HEADER_ROW, 23).getValues();
    let expired = 0;
    values.forEach(function(row, index) {
      const student = studentObject_(row, RSEDU_ACADEMY.DATA_START_ROW + index);
      const expiresAt = student.accessExpiresAt ? new Date(student.accessExpiresAt).getTime() : NaN;
      if (student.accessStatus !== '활성' || !Number.isFinite(expiresAt) || expiresAt > Date.now()) return;
      try {
        expireStudentRow_(ss, student.row, '수강기간 자동 만료');
        expired += 1;
      } catch (error) {
        sheet.getRange(student.row, RSEDU_ACADEMY.STUDENT.ERROR).setValue(`자동 만료 처리 실패: ${error.message}`);
        writeLog_(ss, student.id, student.orderNo, student.email, 'ACCESS_EXPIRE', 'ERROR', error.message, 0);
      }
    });
    return { ok: true, expired: expired };
  } finally {
    lock.releaseLock();
  }
}

function sendAccessEmail_(course, student, code, expiresAt) {
  const expiry = Utilities.formatDate(expiresAt, 'Asia/Seoul', 'yyyy년 M월 d일');
  const subject = `[LMC Academy] ${student.studentName}님 수강 입장코드가 발급되었습니다`;
  const plainBody = [
    `${student.studentName}님, 결제 확인이 완료되었습니다.`,
    '',
    `입장코드: ${code}`,
    `강의실: ${course.entryUrl}`,
    `수강기간: ${expiry}까지`,
    '',
    '강의는 별도의 영상 서비스 로그인 없이 LMC 강의실 안에서 비공개 Cloudflare R2 방식으로 재생됩니다.',
    '입장코드와 강의실 주소를 타인에게 공유하지 마세요.'
  ].join('\n');

  const htmlBody = `
    <div style="max-width:640px;margin:0 auto;padding:32px;font-family:Arial,'Noto Sans KR',sans-serif;color:#071c43;background:#f5f3ed">
      <div style="padding:34px;background:#071c43;color:#fff">
        <div style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#83ffa3">RS EDU CONSULTING · LMC ACADEMY</div>
        <h1 style="margin:18px 0 8px;font-size:32px;line-height:1.15">${escapeHtml_(student.studentName)}님,<br>강의실이 열렸습니다.</h1>
        <p style="margin:0;color:rgba(255,255,255,.72);line-height:1.7">결제 확인과 LMC 수강권 발급이 완료되었습니다.</p>
      </div>
      <div style="padding:32px;background:#fff">
        <div style="font-size:12px;font-weight:800;color:#087d59">8자리 입장코드</div>
        <div style="margin:12px 0 24px;padding:20px;text-align:center;font-size:32px;font-weight:900;letter-spacing:.18em;background:#eef8f0">${escapeHtml_(code.slice(0, 4) + ' ' + code.slice(4))}</div>
        <a href="${escapeHtml_(course.entryUrl)}" style="display:block;padding:16px 20px;text-align:center;text-decoration:none;font-weight:900;color:#071c43;background:#83ffa3">LMC 강의실 입장 →</a>
        <table style="width:100%;margin-top:24px;border-collapse:collapse;font-size:13px">
          <tr><td style="padding:10px 0;color:#68738a">등록 이메일</td><td style="padding:10px 0;text-align:right;font-weight:800">${escapeHtml_(student.email)}</td></tr>
          <tr><td style="padding:10px 0;color:#68738a">수강 만료일</td><td style="padding:10px 0;text-align:right;font-weight:800">${escapeHtml_(expiry)}</td></tr>
        </table>
        <p style="margin:24px 0 0;padding:16px;background:#f7f7f4;color:#58647a;font-size:12px;line-height:1.7">별도 영상 계정은 필요하지 않습니다. 강의실 입장 후 영상이 보이지 않으면 브라우저를 새로고침하고, 문제가 계속되면 이 메일에 회신해 주세요. 입장코드와 강의실 주소의 타인 공유는 허용되지 않습니다.</p>
      </div>
    </div>`;

  const mailOptions = {
    to: student.email,
    subject: subject,
    body: plainBody,
    htmlBody: htmlBody,
    name: course.senderName || 'RS에듀컨설팅 LMC Academy'
  };
  if (course.replyEmail && isValidEmail_(course.replyEmail)) mailOptions.replyTo = course.replyEmail;
  MailApp.sendEmail(mailOptions);
}
