const MAEUM_BOOK_NEWS_SYNC_VERSION = 'maeum-book-news-v2.4.1';
const MAEUM_BOOK_NEWS_DEFAULT_ENDPOINT = 'https://maeum-api.daily-coach-ing.com/api/news/sync';

function installMaeumBookNewsSync() {
  const handler = 'syncMaeumApprovedBookNews';
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === handler)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(15).create();
  return { ok: true, handler, intervalMinutes: 15, version: MAEUM_BOOK_NEWS_SYNC_VERSION };
}

function previewMaeumApprovedBookNews() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return maeumBuildBookNewsPayload_(
    spreadsheet.getSheetByName('뉴스편집').getDataRange().getValues(),
    spreadsheet.getSheetByName('발행목록').getDataRange().getValues()
  );
}

function syncMaeumApprovedBookNews() {
  const properties = PropertiesService.getScriptProperties();
  const token = String(properties.getProperty('SHEETS_SYNC_TOKEN') || '').trim();
  const endpoint = String(properties.getProperty('MAEUM_BOOK_NEWS_API_URL') || MAEUM_BOOK_NEWS_DEFAULT_ENDPOINT).trim();
  if (token.length < 32) throw new Error('SHEETS_SYNC_TOKEN 스크립트 속성을 확인해 주세요.');
  if (!/^https:\/\/maeum-api\.daily-coach-ing\.com\/api\/news\/sync$/.test(endpoint)) {
    throw new Error('MAEUM_BOOK_NEWS_API_URL은 공식 도서뉴스 동기화 주소여야 합니다.');
  }

  const payload = previewMaeumApprovedBookNews();
  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) throw new Error(`도서뉴스 동기화 실패 (${status}): ${body.slice(0, 300)}`);
  return JSON.parse(body);
}

function maeumBuildBookNewsPayload_(editorialValues, publicationValues) {
  const editorialRows = maeumRowsByHeader_(editorialValues);
  const publicationRows = maeumRowsByHeader_(publicationValues);
  const editorialById = {};
  editorialRows.forEach((row) => {
    const id = maeumText_(row.news_id);
    if (id) editorialById[id] = row;
  });

  const items = publicationRows.flatMap((publication, index) => {
    const publicationStatus = maeumText_(publication['상태']).toLowerCase();
    if (publicationStatus !== '발행됨' && publicationStatus !== 'published') return [];
    const id = maeumText_(publication.news_id);
    const editorial = editorialById[id];
    if (!editorial || maeumText_(editorial['최종검수']) !== '승인') return [];

    const title = maeumText_(editorial['마음서재제목'] || publication['제목']);
    const imageRightsApproved = maeumText_(editorial['이미지권리확인']) === '확인 완료';
    const imageOwned = maeumText_(editorial['이미지출처']).includes('마음서재');
    const imageUrl = imageRightsApproved && imageOwned ? maeumText_(editorial['대표이미지URL']) : '';
    const item = {
      id,
      status: 'published',
      title,
      url: maeumText_(editorial['원문URL'] || publication['원문URL']),
      articleSource: maeumText_(editorial['원문출처'] || publication['원문출처']),
      publishedAt: maeumIso_(editorial['원문발행일'] || publication['발행일']),
      summary: maeumText_(editorial['사실요약']),
      category: maeumPublicCategory_(editorial['카테고리'] || publication['카테고리']),
      editorialNote: maeumText_(editorial['마음서재편집노트']),
      approvedBy: maeumText_(editorial['편집자'] || publication['편집자']),
      approvedAt: maeumIso_(editorial['최종수정일'] || publication['수정일'] || publication['발행일']),
      sourceSheetRow: `발행목록!${index + 2}`,
    };
    if (imageUrl) {
      item.imageUrl = imageUrl;
      item.imageAlt = `${title} 관련 마음서재 편집 이미지`;
    }
    if (!item.id || !item.title || !item.url || !item.articleSource || !item.publishedAt || !item.summary || !item.editorialNote || !item.approvedBy || !item.approvedAt) return [];
    return [item];
  });

  return { source: 'google-sheets-book-news-editorial', mode: 'replace-published-set', items };
}

function maeumRowsByHeader_(values) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = values[0].map(maeumText_);
  return values.slice(1).map((valuesRow) => {
    const row = {};
    headers.forEach((header, index) => { if (header) row[header] = valuesRow[index]; });
    return row;
  });
}

function maeumPublicCategory_(value) {
  const category = maeumText_(value);
  if (category === '새로 나온 책') return '새 책';
  if (category === '한줄톡에서 발견한 책' || category === '책과 마음' || category === '다시 읽는 책' || category === '오늘의 도서뉴스') return '독서문화';
  return category || '독서문화';
}

function maeumIso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function maeumText_(value) {
  return value == null ? '' : String(value).trim();
}
