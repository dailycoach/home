const CFM_SPREADSHEET_ID = '11mL-2XIC4ovSRw-mgxRGbeYm1ppxJ5S6ZlCvcefltE4';
const CFM_SHEET_NAME = '참여기록';
const CFM_SCHEMA = '1.0';

function doPost(e) {
  try {
    const raw = e && e.postData ? String(e.postData.contents || '') : '';
    if (!raw || raw.length > 12000) return json_({ ok: false, error: 'invalid-body' });
    const p = JSON.parse(raw);
    if (String(p.schemaVersion || '') !== CFM_SCHEMA) return json_({ ok: false, error: 'schema' });
    const id = safeId_(p.submissionId);
    if (!id) return json_({ ok: false, error: 'submission-id' });
    const mode = String(p.mode || '').toUpperCase();
    if (mode !== 'SELF' && mode !== 'LIVE') return json_({ ok: false, error: 'mode' });
    const start = score_(p.start), end = score_(p.end);
    if (!start || !end) return json_({ ok: false, error: 'score' });
    const startedAt = date_(p.startedAt), endedAt = date_(p.endedAt);
    if (!startedAt || !endedAt || endedAt.getTime() < startedAt.getTime()) return json_({ ok: false, error: 'time' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = SpreadsheetApp.openById(CFM_SPREADSHEET_ID).getSheetByName(CFM_SHEET_NAME);
      if (!sheet) throw new Error('sheet-not-found');
      const memo = 'CFM1|' + id;
      const duplicate = sheet.getRange('Q:Q').createTextFinder(memo).matchEntireCell(true).findNext();
      if (!duplicate) {
        const last = sheet.getRange(sheet.getMaxRows(), 2).getNextDataCell(SpreadsheetApp.Direction.UP).getRow();
        const row = Math.max(2, last + 1);
        sheet.getRange(row, 2, 1, 5).setValues([[startedAt, endedAt, mode, start, end]]);
        sheet.getRange(row, 9, 1, 4).setValues([[
          cleanText_(p.emotionChange),
          cleanText_(p.rule),
          cleanText_(p.awareness),
          cleanText_(p.nextChoice)
        ]]);
        sheet.getRange(row, 17).setValue(memo);
      }
      CacheService.getScriptCache().put('cfm:' + id, '1', 21600);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true, submissionId: id });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: 'server' });
  }
}

function doGet(e) {
  const callback = safeCallback_(e && e.parameter ? e.parameter.callback : '');
  const id = safeId_(e && e.parameter ? e.parameter.submissionId : '');
  let found = false;
  if (id) {
    found = CacheService.getScriptCache().get('cfm:' + id) === '1';
    if (!found) {
      const sheet = SpreadsheetApp.openById(CFM_SPREADSHEET_ID).getSheetByName(CFM_SHEET_NAME);
      found = !!sheet.getRange('Q:Q').createTextFinder('CFM1|' + id).matchEntireCell(true).findNext();
    }
  }
  const body = callback + '(' + JSON.stringify({ ok: true, found: found }) + ');';
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function cleanText_(value) {
  let text = String(value || '').replace(/[\\u0000-\\u001f\\u007f]/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 700);
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi, '[이메일 삭제]');
  text = text.replace(/(?:https?:\\/\\/|www\\.)\\S+/gi, '[링크 삭제]');
  text = text.replace(/(?:\\+?82[-. ]?)?0?1[016789][-. ]?\\d{3,4}[-. ]?\\d{4}/g, '[연락처 삭제]');
  text = text.replace(/\\b\\d{6}[- ]?[1-4]\\d{6}\\b/g, '[식별번호 삭제]');
  return /^[=+\\-@]/.test(text) ? "'" + text : text;
}
function score_(value) { const n = Number(value); return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 0; }
function date_(value) { const d = new Date(String(value || '')); return isNaN(d.getTime()) ? null : d; }
function safeId_(value) { const s = String(value || ''); return /^[A-Za-z0-9-]{12,80}$/.test(s) ? s : ''; }
function safeCallback_(value) { const s = String(value || ''); return /^__[A-Za-z0-9_$]{8,80}$/.test(s) ? s : '__cfmInvalid'; }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
