const DEFAULT_ALLOWED_ORIGIN = 'https://daily-coach-ing.com';
const DEFAULT_DATA_SOURCE_ID = '367cc114-9118-43e4-9920-0decf9ae3e75';
const DEFAULT_NOTION_VERSION = '2025-09-03';
const SUBMIT_PATHS = new Set(['/api/kgm210-submit', '/wp-json/kgm210/v1/submit']);
const EXPORT_PATHS = new Map([
  ['/wp-json/kgm210/v1/export-csv', 'wide'],
  ['/wp-json/kgm210/v1/export-wide-csv', 'wide'],
  ['/wp-json/kgm210/v1/export-long-csv', 'long'],
  ['/api/kgm210-export-wide', 'wide'],
  ['/api/kgm210-export-long', 'long']
]);

const P = {
  submissionId: '\uC81C\uCD9CID',
  anonymousResearchId: '\uC775\uBA85\uC5F0\uAD6CID',
  submittedAt: '\uC81C\uCD9C\uC77C\uC2DC',
  version: '\uAC80\uC0AC\uBC84\uC804',
  scale: '\uCC99\uB3C4',
  sampleGroup: '\uD45C\uBCF8\uAD6C\uBD84',
  ageBand: '\uC5F0\uB839\uB300',
  gender: '\uC131\uBCC4',
  occupationGroup: '\uC9C1\uC5C5\uAD70',
  testPurpose: '\uAC80\uC0AC\uBAA9\uC801',
  coachingExperience: '\uCF54\uCE6D\uACBD\uD5D8',
  retestKey: '\uC7AC\uAC80\uC0AC\uD0A4',
  durationSec: '\uAC80\uC0AC\uC18C\uC694\uCD08',
  overallAvg: '\uC804\uCCB4\uD3C9\uADE0',
  axisX: 'X \uC54C\uC544\uCC28\uB9BC',
  axisY: 'Y \uC138\uC6B0\uAE30',
  axisZ: 'Z \uD574\uBCF4\uAE30',
  domainK: 'K \uC8FC\uB3C4\uC131',
  domainI: 'I \uC874\uC7AC\uCD08\uC810',
  domainN: 'N \uC790\uAE30\uC774\uC57C\uAE30',
  domainG: 'G \uACE0\uC720\uC131',
  domainD: 'D \uCC45\uC784\uACBD\uACC4',
  domainO: 'O \uC2E4\uD589\uAE30\uD68C',
  domainM: 'M \uC131\uC7A5\uD1B5\uD569',
  researchUseStatus: '\uC5F0\uAD6C\uC0AC\uC6A9\uC0C1\uD0DC',
  completed: '\uC644\uB8CC\uC5EC\uBD80',
  answerCount: '\uC751\uB2F5\uC218',
  itemResponsesJson: '\uBB38\uD56D\uC751\uB2F5JSON',
  sheetSync: '\uC2A4\uD504\uB808\uB4DC\uC2DC\uD2B8\uB3D9\uAE30\uD654'
};

const V = {
  usable: '\uC0AC\uC6A9\uAC00\uB2A5',
  complete: '\uC644\uB8CC',
  failed: '\uC2E4\uD328'
};

const WIDE_BASE_HEADERS = [
  P.submissionId, P.anonymousResearchId, P.submittedAt, P.version, P.scale,
  P.sampleGroup, P.ageBand, P.gender, P.occupationGroup, P.testPurpose,
  P.coachingExperience, P.retestKey, P.durationSec, P.overallAvg,
  P.axisX, P.axisY, P.axisZ,
  P.domainK, P.domainI, P.domainN, P.domainG, P.domainD, P.domainO, P.domainM
];
const WIDE_HEADERS = [
  ...WIDE_BASE_HEADERS,
  ...Array.from({ length: 210 }, (_, index) => `Q${String(index + 1).padStart(3, '0')}`)
];
const LONG_HEADERS = [
  P.submissionId, P.anonymousResearchId, P.submittedAt, P.version, P.scale,
  '\uBB38\uD56D\uBC88\uD638', '\uC601\uC5ED', '\uACFC\uC815', 'Z\uC9C0\uD45C', '\uC751\uB2F5\uAC12'
];

const SELECT_OPTIONS = {
  '척도': ['7점', '5점'],
  '성장유형': ['개척형', '정렬형', '전환형', '통합형', '탐색형', '보류'],
  '표본구분': ['일반', '코칭고객', '교육참여자', '파일럿', '재검사'],
  '연령대': ['10대', '20대', '30대', '40대', '50대', '60대 이상', '미응답'],
  '성별': ['여성', '남성', '기타/무응답'],
  '직업군': ['학생', '직장인', '자영업/사업자', '전문직', '코치/상담자', '기타', '미응답'],
  '검사목적': ['자가점검', '코칭전', '코칭후', '교육전', '교육후', '파일럿', '재검사'],
  '코칭경험': ['없음', '1회 이하', '2~5회', '6회 이상', '미응답'],
  '연구사용상태': ['사용가능', '보류', '제외', '삭제요청'],
  '저장API상태': ['대기', '성공', '실패', '중복'],
  '스프레드시트동기화': ['대기', '완료', '실패', '제외']
};

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};

export async function handleRequest(request, env = {}) {
  const allowedOrigin = env.KGM210_ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const cors = corsHeaders(origin, allowedOrigin);
  const exportKind = EXPORT_PATHS.get(url.pathname);
  const isSubmitPath = SUBMIT_PATHS.has(url.pathname);

  if (!isSubmitPath && !exportKind) {
    return json({ ok: false, message: 'not_found' }, 404, cors);
  }

  if (!isAllowedOrigin(origin, allowedOrigin)) {
    return json({ ok: false, message: 'forbidden_origin' }, 403, cors);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (exportKind) {
    return handleExportRequest(request, env, exportKind, cors);
  }

  if (request.method !== 'POST') {
    return json({ ok: false, message: 'method_not_allowed' }, 405, {
      ...cors,
      Allow: 'POST, OPTIONS'
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ ok: false, message: 'invalid_json' }, 400, cors);
  }

  const validation = validatePayload(payload);
  if (!validation.ok) {
    return json({ ok: false, message: 'invalid_payload', errors: validation.errors }, 400, cors);
  }

  const notionToken = env.NOTION_TOKEN;
  const dataSourceId = env.NOTION_KGM210_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID;
  if (!notionToken) {
    return json({ ok: false, message: 'server_env_missing', missing: ['NOTION_TOKEN'] }, 500, cors);
  }

  const enrichedPayload = {
    ...payload,
    userAgent: payload.userAgent || request.headers.get('User-Agent') || '',
    pageUrl: payload.pageUrl || request.headers.get('Referer') || ''
  };

  try {
    const existing = await findExistingSubmission(env, dataSourceId, enrichedPayload.submissionId);
    if (existing) {
      return json({
        ok: true,
        duplicate: true,
        submissionId: enrichedPayload.submissionId,
        pageId: existing.id || null,
        pageUrl: existing.url || null
      }, 200, cors);
    }

    const created = await createNotionPage(env, dataSourceId, enrichedPayload, '성공');
    return json({
      ok: true,
      duplicate: false,
      submissionId: enrichedPayload.submissionId,
      pageId: created.id,
      pageUrl: created.url || null
    }, 200, cors);
  } catch (error) {
    const message = safeErrorMessage(error);
    console.error('[kgm210-submit] save failed', {
      submissionId: enrichedPayload.submissionId,
      anonymousResearchId: enrichedPayload.anonymousResearchId,
      message
    });
    await tryCreateFailurePage(env, dataSourceId, enrichedPayload, message);
    return json({ ok: false, message: 'notion_save_failed', error: message }, 502, cors);
  }
}

async function handleExportRequest(request, env, exportKind, cors) {
  if (!['GET', 'POST'].includes(request.method)) {
    return json({ ok: false, message: 'method_not_allowed' }, 405, {
      ...cors,
      Allow: 'GET, POST, OPTIONS'
    });
  }

  const notionToken = env.NOTION_TOKEN;
  const dataSourceId = env.NOTION_KGM210_DATA_SOURCE_ID || DEFAULT_DATA_SOURCE_ID;
  if (!notionToken) {
    return json({ ok: false, message: 'server_env_missing', missing: ['NOTION_TOKEN'] }, 500, cors);
  }

  try {
    const pages = await fetchExportPages(env, dataSourceId);
    const transformed = await buildExportRows(env, pages);
    const headers = exportKind === 'long' ? LONG_HEADERS : WIDE_HEADERS;
    const rows = exportKind === 'long' ? transformed.longRows : transformed.wideRows;
    const csv = toCsv(headers, rows);
    const filename = `kgm210_${exportKind}_${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-KGM210-Export-Format': exportKind,
        'X-KGM210-Export-Records': String(transformed.wideRows.length),
        'X-KGM210-Export-Rows': String(rows.length),
        'X-KGM210-Export-Failed-Pages': String(transformed.failedPageIds.length)
      }
    });
  } catch (error) {
    return json({ ok: false, message: 'export_failed', error: safeErrorMessage(error) }, 502, cors);
  }
}

async function fetchExportPages(env, dataSourceId) {
  const pages = [];
  let startCursor = null;
  do {
    const body = {
      page_size: 100,
      filter: {
        and: [
          { property: P.researchUseStatus, select: { equals: V.usable } },
          { property: P.completed, checkbox: { equals: true } },
          { property: P.answerCount, number: { equals: 210 } },
          { property: P.itemResponsesJson, rich_text: { is_not_empty: true } },
          { property: P.anonymousResearchId, rich_text: { is_not_empty: true } }
        ]
      }
    };
    if (startCursor) body.start_cursor = startCursor;
    const data = await notionRequest(env, `/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    pages.push(...(Array.isArray(data.results) ? data.results : []));
    startCursor = data.has_more ? data.next_cursor : null;
  } while (startCursor);
  return pages;
}

async function buildExportRows(env, pages) {
  const wideRows = [];
  const longRows = [];
  const failedPageIds = [];

  for (const page of pages) {
    try {
      const record = pageToExportRecord(page);
      wideRows.push(record.wideRow);
      longRows.push(...record.longRows);
      await updateSpreadsheetSyncStatus(env, page.id, V.complete);
    } catch (error) {
      failedPageIds.push(page.id);
      await updateSpreadsheetSyncStatus(env, page.id, V.failed).catch((nestedError) => {
        console.error('[kgm210-export] failed status update failed', {
          pageId: page.id,
          message: safeErrorMessage(nestedError)
        });
      });
      console.error('[kgm210-export] row conversion failed', {
        pageId: page.id,
        message: safeErrorMessage(error)
      });
    }
  }

  return { wideRows, longRows, failedPageIds };
}

function pageToExportRecord(page) {
  const props = page.properties || {};
  const itemResponses = parseItemResponses(propText(props, P.itemResponsesJson));
  const valuesByNo = new Map();
  const normalizedItems = itemResponses.map((item, index) => normalizeItemResponse(item, index));

  for (const item of normalizedItems) {
    if (item.no < 1 || item.no > 210) throw new Error(`question number out of range: ${item.no}`);
    if (!Number.isInteger(item.value) || item.value < 1 || item.value > 7) {
      throw new Error(`invalid response value for Q${item.no}: ${item.value}`);
    }
    valuesByNo.set(item.no, item);
  }
  if (valuesByNo.size !== 210) throw new Error(`expected 210 unique item responses, got ${valuesByNo.size}`);

  const base = {
    [P.submissionId]: propText(props, P.submissionId),
    [P.anonymousResearchId]: propText(props, P.anonymousResearchId),
    [P.submittedAt]: propText(props, P.submittedAt),
    [P.version]: propText(props, P.version),
    [P.scale]: propText(props, P.scale),
    [P.sampleGroup]: propText(props, P.sampleGroup),
    [P.ageBand]: propText(props, P.ageBand),
    [P.gender]: propText(props, P.gender),
    [P.occupationGroup]: propText(props, P.occupationGroup),
    [P.testPurpose]: propText(props, P.testPurpose),
    [P.coachingExperience]: propText(props, P.coachingExperience),
    [P.retestKey]: propText(props, P.retestKey),
    [P.durationSec]: propNumber(props, P.durationSec),
    [P.overallAvg]: propNumber(props, P.overallAvg),
    [P.axisX]: propNumber(props, P.axisX),
    [P.axisY]: propNumber(props, P.axisY),
    [P.axisZ]: propNumber(props, P.axisZ),
    [P.domainK]: propNumber(props, P.domainK),
    [P.domainI]: propNumber(props, P.domainI),
    [P.domainN]: propNumber(props, P.domainN),
    [P.domainG]: propNumber(props, P.domainG),
    [P.domainD]: propNumber(props, P.domainD),
    [P.domainO]: propNumber(props, P.domainO),
    [P.domainM]: propNumber(props, P.domainM)
  };

  if (!base[P.submissionId]) throw new Error('submission id missing');
  if (!base[P.anonymousResearchId]) throw new Error('anonymous research id missing');

  const wideRow = { ...base };
  for (let no = 1; no <= 210; no += 1) {
    wideRow[`Q${String(no).padStart(3, '0')}`] = valuesByNo.get(no)?.value ?? '';
  }

  const longRows = Array.from({ length: 210 }, (_, index) => {
    const item = valuesByNo.get(index + 1);
    return {
      [P.submissionId]: base[P.submissionId],
      [P.anonymousResearchId]: base[P.anonymousResearchId],
      [P.submittedAt]: base[P.submittedAt],
      [P.version]: base[P.version],
      [P.scale]: base[P.scale],
      '\uBB38\uD56D\uBC88\uD638': item.no,
      '\uC601\uC5ED': item.domain,
      '\uACFC\uC815': item.process,
      'Z\uC9C0\uD45C': item.z ? '1' : '0',
      '\uC751\uB2F5\uAC12': item.value
    };
  });

  return { wideRow, longRows };
}

function parseItemResponses(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error('itemResponsesJson is not valid JSON');
  }
  if (!Array.isArray(parsed) || parsed.length !== 210) {
    throw new Error(`itemResponsesJson must contain 210 rows, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`);
  }
  return parsed;
}

function normalizeItemResponse(item, index) {
  return {
    no: Number(item.no ?? item.questionNo ?? item.questionNumber ?? item['\uBB38\uD56D\uBC88\uD638'] ?? index + 1),
    domain: sanitizeText(item.domain ?? item['\uC601\uC5ED']),
    process: sanitizeText(item.process ?? item['\uACFC\uC815']),
    z: Boolean(item.z ?? item.zIndicator ?? item['Z\uC9C0\uD45C']),
    value: Number(item.value ?? item.answer ?? item.score ?? item['\uC751\uB2F5\uAC12'])
  };
}

async function updateSpreadsheetSyncStatus(env, pageId, status) {
  if (!pageId) return null;
  return notionRequest(env, `/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        [P.sheetSync]: { select: { name: status } }
      }
    })
  });
}

function propText(props, name) {
  const prop = props?.[name];
  if (!prop) return '';
  if (prop.type === 'title') return joinPlain(prop.title);
  if (prop.type === 'rich_text') return joinPlain(prop.rich_text);
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'checkbox') return prop.checkbox ? 'true' : 'false';
  if (prop.type === 'number') return prop.number ?? '';
  if (prop.type === 'date') return prop.date?.start || '';
  if (prop.type === 'url') return prop.url || '';
  return '';
}

function propNumber(props, name) {
  const prop = props?.[name];
  if (!prop) return '';
  const n = prop.type === 'number' ? Number(prop.number) : Number(propText(props, name));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : '';
}

function joinPlain(parts = []) {
  return parts.map((part) => part.plain_text ?? part.text?.content ?? '').join('');
}

function toCsv(headers, rows) {
  return [
    headers.map(csvCell).join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
  ].join('\r\n');
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function validatePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') errors.push('payload object required');
  if (payload?.completed !== true) errors.push('completed=true required');
  if (Number(payload?.answerCount) !== 210) errors.push('answerCount=210 required');
  if (!nonEmpty(payload?.anonymousResearchId)) errors.push('anonymousResearchId required');
  if (!nonEmpty(payload?.submissionId)) errors.push('submissionId required');
  if (!nonEmpty(payload?.itemResponsesJson)) errors.push('itemResponsesJson required');

  if (nonEmpty(payload?.itemResponsesJson)) {
    try {
      const parsed = JSON.parse(payload.itemResponsesJson);
      if (!Array.isArray(parsed) || parsed.length !== 210) {
        errors.push('itemResponsesJson must be an array with 210 items');
      }
    } catch (error) {
      errors.push('itemResponsesJson must be valid JSON');
    }
  }

  return { ok: errors.length === 0, errors };
}

async function findExistingSubmission(env, dataSourceId, submissionId) {
  const body = {
    page_size: 1,
    filter: {
      property: '제출ID',
      rich_text: { equals: submissionId }
    }
  };
  const data = await notionRequest(env, `/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return Array.isArray(data.results) && data.results.length > 0 ? data.results[0] : null;
}

async function createNotionPage(env, dataSourceId, payload, apiStatus, errorMessage = '') {
  return notionRequest(env, '/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { data_source_id: dataSourceId },
      properties: buildProperties(payload, apiStatus, errorMessage)
    })
  });
}

async function tryCreateFailurePage(env, dataSourceId, payload, errorMessage) {
  try {
    await createNotionPage(env, dataSourceId, payload, '실패', errorMessage);
  } catch (nestedError) {
    console.error('[kgm210-submit] failure row creation failed', {
      submissionId: payload?.submissionId,
      message: safeErrorMessage(nestedError)
    });
  }
}

async function notionRequest(env, path, init = {}) {
  const base = env.NOTION_API_BASE || 'https://api.notion.com/v1';
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': env.NOTION_VERSION || DEFAULT_NOTION_VERSION,
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? safeJsonParse(text, { raw: text }) : {};
  if (!response.ok) {
    const message = data.message || data.raw || `Notion API ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function buildProperties(payload, apiStatus, errorMessage = '') {
  const props = {};
  const add = (name, value) => {
    if (value !== undefined) props[name] = value;
  };

  const axes = payload.axes || {};
  const domains = payload.domains || {};
  const rawJson = payload.rawJson || JSON.stringify(payload);
  const title = payload.recordTitle || `KGM210_${payload.anonymousResearchId}_${dateKey(payload.createdAt)}`;

  add('제출ID', richText(payload.submissionId));
  add('검사기록', titleProp(title));
  add('제출일시', dateProp(payload.createdAt || new Date().toISOString()));
  add('이름', richText(payload.name));
  add('연락처', richText(payload.contact));
  add('검사버전', richText(payload.version));
  add('척도', selectProp('척도', normalizeScale(payload.scale), '7점'));
  add('성장유형', selectProp('성장유형', payload.growthType, '보류'));
  add('성장단계', richText(payload.growthLevel));
  add('전체평균', numberProp(payload.overallAvg));
  add('X 알아차림', numberProp(axes.X));
  add('Y 세우기', numberProp(axes.Y));
  add('Z 해보기', numberProp(axes.Z));
  add('K 주도성', numberProp(domains.K));
  add('I 존재초점', numberProp(domains.I));
  add('N 자기이야기', numberProp(domains.N));
  add('G 고유성', numberProp(domains.G));
  add('D 책임경계', numberProp(domains.D));
  add('O 실행기회', numberProp(domains.O));
  add('M 성장통합', numberProp(domains.M));
  add('상위영역', richText(payload.topDomain));
  add('우선성장영역', richText(payload.priorityDomain));
  add('결과요약', richText(payload.summary));
  add('추천실험', richText(payload.experiments));
  add('응답수', numberProp(payload.answerCount));
  add('완료여부', checkboxProp(payload.completed));
  add('원본JSON', richText(rawJson));
  add('문항응답JSON', richText(payload.itemResponsesJson));
  add('User Agent', richText(payload.userAgent));
  add('페이지URL', urlProp(payload.pageUrl));
  add('익명연구ID', richText(payload.anonymousResearchId));
  add('표본구분', selectProp('표본구분', payload.sampleGroup, '일반'));
  add('연령대', selectProp('연령대', payload.ageBand, '미응답'));
  add('성별', selectProp('성별', payload.gender, '기타/무응답'));
  add('직업군', selectProp('직업군', payload.occupationGroup, '미응답'));
  add('검사목적', selectProp('검사목적', payload.testPurpose, '자가점검'));
  add('코칭경험', selectProp('코칭경험', payload.coachingExperience, '미응답'));
  add('재검사키', richText(payload.retestKey));
  add('수집동의버전', richText(payload.consentVersion));
  add('연구사용상태', selectProp('연구사용상태', normalizeResearchStatus(payload.researchUseStatus, payload.researchConsent), '사용가능'));
  add('연구활용동의', checkboxProp(payload.researchConsent !== false));
  add('검사소요초', numberProp(payload.durationSec));
  add('저장API상태', selectProp('저장API상태', apiStatus, apiStatus));
  add('저장오류', richText(errorMessage));
  add('스프레드시트동기화', selectProp('스프레드시트동기화', '대기', '대기'));

  return props;
}

function titleProp(value) {
  return { title: textChunks(value || 'KGM210 검사결과') };
}

function richText(value) {
  const chunks = textChunks(value);
  return chunks.length ? { rich_text: chunks } : { rich_text: [] };
}

function textChunks(value) {
  const text = sanitizeText(value);
  if (!text) return [];
  const chunks = [];
  for (let i = 0; i < text.length && chunks.length < 100; i += 1900) {
    chunks.push({ text: { content: text.slice(i, i + 1900) } });
  }
  return chunks;
}

function selectProp(propertyName, value, fallback) {
  const normalized = normalizeSelect(propertyName, value) || fallback;
  if (!normalized) return undefined;
  return { select: { name: normalized } };
}

function normalizeSelect(propertyName, value) {
  const options = SELECT_OPTIONS[propertyName] || [];
  const text = sanitizeText(value);
  if (!text) return '';
  if (options.includes(text)) return text;
  if (propertyName === '성별' && (text.includes('무응답') || text.includes('기타'))) return '기타/무응답';
  if (propertyName === '직업군' && text.includes('사업')) return '자영업/사업자';
  if (propertyName === '연령대' && text.includes('60')) return '60대 이상';
  if (propertyName === '코칭경험' && text.includes('2') && text.includes('5')) return '2~5회';
  if (propertyName === '코칭경험' && text.includes('6')) return '6회 이상';
  if (propertyName === '코칭경험' && text.includes('1')) return '1회 이하';
  if (propertyName === '코칭경험' && text.includes('없')) return '없음';
  if (propertyName === '척도' && text.includes('7')) return '7점';
  if (propertyName === '척도' && text.includes('5')) return '5점';
  return '';
}

function normalizeScale(value) {
  const text = sanitizeText(value);
  if (text.includes('7')) return '7점';
  if (text.includes('5')) return '5점';
  return text;
}

function normalizeResearchStatus(value, consent) {
  const text = sanitizeText(value);
  if (consent === false) return '제외';
  if (SELECT_OPTIONS['연구사용상태'].includes(text)) return text;
  if (text.includes('제외')) return '제외';
  if (text.includes('보류')) return '보류';
  return '사용가능';
}

function numberProp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return { number: Math.round(n * 100) / 100 };
}

function checkboxProp(value) {
  return { checkbox: value === true || value === 'true' || value === '__YES__' };
}

function dateProp(value) {
  const d = new Date(value);
  return { date: { start: Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString() } };
}

function urlProp(value) {
  const text = sanitizeText(value);
  return { url: text || null };
}

function corsHeaders(origin, allowedOrigin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-KGM210-Export-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (isAllowedOrigin(origin, allowedOrigin)) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }
  return headers;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

function isAllowedOrigin(origin, allowedOrigin) {
  return origin === allowedOrigin;
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\u0000/g, '').trim();
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

function safeErrorMessage(error) {
  return sanitizeText(error?.message || error || 'unknown_error').slice(0, 1800);
}

function dateKey(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}
