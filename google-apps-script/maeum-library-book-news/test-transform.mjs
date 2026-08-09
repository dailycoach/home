import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');
const context = { Date, JSON, Number, Object, String, Array, console };
vm.runInNewContext(code, context);

const editorial = [
  ['news_id', '편집상태', '카테고리', '마음서재제목', '사실요약', '마음서재편집노트', '원문출처', '원문URL', '원문발행일', '대표이미지URL', '이미지출처', '이미지권리확인', '편집자', '최종검수', '최종수정일'],
  ['N-1', '발행 예약', '새로 나온 책', '승인된 제목', '승인된 사실 요약', '독자에게 의미 있는 이유', '공식 출처', 'https://example.com/news/1', '2026-08-01', 'https://daily-coach-ing.com/maeum-library/assets/images/news-books.webp', '마음서재 자체 제작', '확인 완료', '마음서재 편집부', '승인', '2026-08-02'],
  ['N-2', '최종 검수', '오늘의 도서뉴스', '미승인 제목', '요약', '이유', '공식 출처', 'https://example.com/news/2', '2026-08-01', '', '', '미확인', '마음서재 편집부', '검토 대기', '2026-08-02'],
  ['N-3', '발행 예약', '책과 마음', '예약 제목', '요약', '이유', '공식 출처', 'https://example.com/news/3', '2026-08-01', '', '', '미확인', '마음서재 편집부', '승인', '2026-08-02'],
];
const publications = [
  ['published_id', 'news_id', '제목', '카테고리', '원문출처', '원문URL', '발행일', '편집자', '상태', '수정일'],
  ['P-1', 'N-1', '승인된 제목', '새로 나온 책', '공식 출처', 'https://example.com/news/1', '2026-08-03', '마음서재 편집부', '발행됨', '2026-08-03'],
  ['P-2', 'N-2', '미승인 제목', '오늘의 도서뉴스', '공식 출처', 'https://example.com/news/2', '2026-08-03', '마음서재 편집부', '발행됨', '2026-08-03'],
  ['P-3', 'N-3', '예약 제목', '책과 마음', '공식 출처', 'https://example.com/news/3', '2026-08-04', '마음서재 편집부', '예약', '2026-08-04'],
];

const payload = context.maeumBuildBookNewsPayload_(editorial, publications);
assert.equal(payload.source, 'google-sheets-book-news-editorial');
assert.equal(payload.mode, 'replace-published-set');
assert.equal(payload.items.length, 1);
assert.equal(payload.items[0].id, 'N-1');
assert.equal(payload.items[0].status, 'published');
assert.equal(payload.items[0].category, '새 책');
assert.equal(payload.items[0].summary, '승인된 사실 요약');
assert.equal(payload.items[0].editorialNote, '독자에게 의미 있는 이유');
assert.equal(payload.items[0].sourceSheetRow, '발행목록!2');
assert.ok(payload.items[0].imageUrl.includes('/maeum-library/assets/images/'));
assert.ok(!code.includes('Bearer sk-'));
assert.ok(!code.includes('minion.toss.im/7KNQwHZn'));

console.log(JSON.stringify({ ok: true, publishedCount: payload.items.length, reviewGate: true, scheduleGate: true, imageRightsGate: true }));
