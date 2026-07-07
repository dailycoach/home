const KGM210_SHEET_NAMES = {
  wide: 'KGM210_Wide',
  long: 'KGM210_Long',
  log: 'KGM210_Log'
};

const KGM210_WIDE_BASE_HEADERS = [
  '제출ID', '익명연구ID', '제출일시', '검사버전', '척도',
  '표본구분', '연령대', '성별', '직업군', '검사목적',
  '코칭경험', '재검사키', '검사소요초', '전체평균',
  'X 알아차림', 'Y 세우기', 'Z 해보기',
  'K 주도성', 'I 존재초점', 'N 자기이야기', 'G 고유성',
  'D 책임경계', 'O 실행기회', 'M 성장통합'
];

const KGM210_WIDE_HEADERS = KGM210_WIDE_BASE_HEADERS.concat(
  Array.from({ length: 210 }, (_, index) => 'Q' + String(index + 1).padStart(3, '0'))
);

const KGM210_LONG_HEADERS = [
  '제출ID', '익명연구ID', '제출일시', '검사버전', '척도',
  '문항번호', '영역', '과정', 'Z지표', '응답값'
];

const KGM210_LOG_HEADERS = ['기록시각', '제출ID', '익명연구ID', '상태', '메시지'];

function doPost(e) {
  try {
    const action = String((e.parameter && e.parameter.action) || '').trim();
    if (action && action !== 'kgm210Submit') {
      return jsonOutput({ ok: false, message: 'unsupported_action' });
    }

    const payload = parsePayload(e);
    const validation = validateKgm210Payload(payload);
    if (!validation.ok) {
      appendLog(payload, '실패', validation.errors.join('; '));
      return jsonOutput({ ok: false, message: 'invalid_payload', errors: validation.errors });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const sheets = ensureSheets();
      const duplicate = findSubmissionRow(sheets.wide, payload.submissionId) > 0;
      if (duplicate) {
        appendLog(payload, '중복', '이미 저장된 제출ID');
        return jsonOutput({ ok: true, duplicate: true, submissionId: payload.submissionId });
      }

      const rows = buildRows(payload);
      sheets.wide.appendRow(rows.wide);
      if (rows.long.length > 0) {
        sheets.long.getRange(sheets.long.getLastRow() + 1, 1, rows.long.length, KGM210_LONG_HEADERS.length).setValues(rows.long);
      }
      appendLog(payload, '성공', 'Google Sheets 저장 완료');
      return jsonOutput({
        ok: true,
        duplicate: false,
        submissionId: payload.submissionId,
        wideRows: 1,
        longRows: rows.long.length
      });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    appendLog(null, '실패', error && error.message ? error.message : String(error));
    return jsonOutput({ ok: false, message: 'server_error', error: String(error && error.message ? error.message : error) });
  }
}

function doGet(e) {
  const action = String((e.parameter && e.parameter.action) || '').trim();
  if (action === 'export-wide-csv') {
    return csvOutput(sheetToCsv(ensureSheets().wide), 'kgm210_wide.csv');
  }
  if (action === 'export-long-csv') {
    return csvOutput(sheetToCsv(ensureSheets().long), 'kgm210_long.csv');
  }
  return jsonOutput({
    ok: true,
    service: 'KGM210 Google Sheets sync',
    actions: ['kgm210Submit', 'export-wide-csv', 'export-long-csv']
  });
}

function parsePayload(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  if (raw) {
    return JSON.parse(raw);
  }
  throw new Error('payload missing');
}

function validateKgm210Payload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') errors.push('payload object required');
  if (payload && payload.completed !== true) errors.push('completed=true required');
  if (payload && Number(payload.answerCount) !== 210) errors.push('answerCount=210 required');
  if (!payload || !payload.submissionId) errors.push('submissionId required');
  if (!payload || !payload.anonymousResearchId) errors.push('anonymousResearchId required');
  if (!payload || !payload.itemResponsesJson) errors.push('itemResponsesJson required');
  try {
    const items = JSON.parse(payload.itemResponsesJson || '[]');
    if (!Array.isArray(items) || items.length !== 210) {
      errors.push('itemResponsesJson must contain 210 responses');
    }
    items.forEach((item, index) => {
      const value = Number(item.value);
      if (!Number.isInteger(value) || value < 1 || value > 7) {
        errors.push('invalid response value at item ' + (index + 1));
      }
    });
  } catch (error) {
    errors.push('itemResponsesJson must be valid JSON');
  }
  return { ok: errors.length === 0, errors };
}

function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('스프레드시트에서 Apps Script를 열어 실행해야 합니다.');

  const wide = ensureSheet(ss, KGM210_SHEET_NAMES.wide, KGM210_WIDE_HEADERS);
  const long = ensureSheet(ss, KGM210_SHEET_NAMES.long, KGM210_LONG_HEADERS);
  const log = ensureSheet(ss, KGM210_SHEET_NAMES.log, KGM210_LOG_HEADERS);
  return { ss, wide, long, log };
}

function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findSubmissionRow(sheet, submissionId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === String(submissionId)) return i + 2;
  }
  return -1;
}

function buildRows(payload) {
  const axes = payload.axes || {};
  const domains = payload.domains || {};
  const itemResponses = JSON.parse(payload.itemResponsesJson);
  const byNo = {};
  itemResponses.forEach((item, index) => {
    const no = Number(item.no || item.questionNo || index + 1);
    byNo[no] = {
      no,
      domain: item.domain || '',
      process: item.process || '',
      z: item.z ? 1 : 0,
      value: Number(item.value)
    };
  });

  const base = [
    payload.submissionId || '',
    payload.anonymousResearchId || '',
    payload.createdAt || '',
    payload.version || '',
    payload.scale || '',
    payload.sampleGroup || '',
    payload.ageBand || '',
    payload.gender || '',
    payload.occupationGroup || '',
    payload.testPurpose || '',
    payload.coachingExperience || '',
    payload.retestKey || '',
    numberOrBlank(payload.durationSec),
    numberOrBlank(payload.overallAvg),
    numberOrBlank(axes.X),
    numberOrBlank(axes.Y),
    numberOrBlank(axes.Z),
    numberOrBlank(domains.K),
    numberOrBlank(domains.I),
    numberOrBlank(domains.N),
    numberOrBlank(domains.G),
    numberOrBlank(domains.D),
    numberOrBlank(domains.O),
    numberOrBlank(domains.M)
  ];

  const qValues = [];
  const long = [];
  for (let no = 1; no <= 210; no += 1) {
    const item = byNo[no] || {};
    qValues.push(numberOrBlank(item.value));
    long.push([
      payload.submissionId || '',
      payload.anonymousResearchId || '',
      payload.createdAt || '',
      payload.version || '',
      payload.scale || '',
      no,
      item.domain || '',
      item.process || '',
      item.z ? 1 : 0,
      numberOrBlank(item.value)
    ]);
  }

  return { wide: base.concat(qValues), long };
}

function numberOrBlank(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : '';
}

function appendLog(payload, status, message) {
  try {
    const sheets = ensureSheets();
    sheets.log.appendRow([
      new Date(),
      payload && payload.submissionId ? payload.submissionId : '',
      payload && payload.anonymousResearchId ? payload.anonymousResearchId : '',
      status,
      message || ''
    ]);
  } catch (error) {
    console.error(error);
  }
}

function sheetToCsv(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  return values.map(row => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function csvOutput(csv, filename) {
  return ContentService
    .createTextOutput('\uFEFF' + csv)
    .setMimeType(ContentService.MimeType.CSV)
    .downloadAsFile(filename);
}

