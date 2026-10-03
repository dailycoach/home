(function (scope) {
  'use strict';
  const types = Object.freeze({ pdfEbook: 'PDF 전자책', pdfWorkbook: 'PDF 워크북', pdfWorksheet: '활동지', digitalGuide: '코칭·교육 자료', physicalCard: '실물 카드', physicalBook: '실물 워크북', kit: '키트' });
  const licenses = Object.freeze({ 'personal-use': '개인 이용', 'facilitator-use': '진행자 이용', 'organization-use': '기관 이용' });
  const topics = ['자기이해', '감정', '관계', '코칭', '커리어', '강점·가치', '글쓰기', '리더십', '교육', '기타'];
  const audiences = ['개인', '코치', '교사', '상담·교육자', '부모', '조직·팀'];
  const list = (value) => Array.isArray(value) ? value : [];
  const type = (item) => ({ card: 'physicalCard', workbook: 'physicalBook', pdf: 'pdfEbook', digital: 'digitalGuide' }[item?.productType] || item?.productType);
  const digital = (item) => item?.deliveryType === 'digital' || ['pdfEbook', 'pdfWorkbook', 'pdfWorksheet', 'digitalGuide'].includes(type(item));
  const searchable = (item) => [item.title, item.subtitle, item.author, item.name, item.summary, item.description, item.headline, item.bio, item.body, item.category, ...list(item.tags), ...list(item.topics), ...list(item.audiences), ...list(item.fields), ...list(item.tableOfContents)].filter(Boolean).join(' ').toLocaleLowerCase('ko');

  function safePublicUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const input = value.trim();
      if ((!input.startsWith('/') && !/^https:\/\//i.test(input)) || input.includes('\\')) return '';
      const url = new URL(input, 'https://daily-coach-ing.com');
      if (url.protocol !== 'https:' || url.username || url.password || input.startsWith('//')) return '';
      if (/nal-products-private/i.test(decodeURIComponent(url.pathname))
        || [...url.searchParams.keys()].some(key => /^(token|signature|access_token|payment_id)$/i.test(key))) return '';
      return input.startsWith('/') ? url.pathname + url.search + url.hash : url.href;
    } catch { return ''; }
  }

  function preview(item) {
    return safePublicUrl(item.sampleUrl) || safePublicUrl(item.previewUrl);
  }

  function filter(items, params = new URLSearchParams()) {
    const q = (params.get('q') || '').trim().toLocaleLowerCase('ko');
    const form = params.get('format') || '';
    const topic = params.get('topic') || '';
    const audience = params.get('audience') || '';
    const category = params.get('category') || '';
    let result = list(items).filter((p) => p.published === true
      && (!q || searchable(p).includes(q))
      && (!category || p.category === category)
      && (!topic || [p.category, ...list(p.tags), ...list(p.topics)].includes(topic))
      && (!audience || list(p.audiences).includes(audience))
      && (!form || (form === 'digital' ? digital(p) : form === 'physical' ? !digital(p) : form === 'workbook' ? ['pdfWorkbook', 'pdfWorksheet'].includes(type(p)) : form === 'guide' ? type(p) === 'digitalGuide' : type(p) === form)));
    const number = (p) => Number.isFinite(p.price) ? p.price : null;
    const sort = params.get('sort') || 'recommended';
    result.sort((a, b) => {
      if (sort === 'newest') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      if (sort === 'lowPrice' || sort === 'highPrice') {
        const x = number(a), y = number(b);
        return x === null ? (y === null ? 0 : 1) : y === null ? -1 : sort === 'highPrice' ? y - x : x - y;
      }
      return Number(digital(b)) - Number(digital(a)) || Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || (a.featuredOrder ?? Number.MAX_SAFE_INTEGER) - (b.featuredOrder ?? Number.MAX_SAFE_INTEGER);
    });
    return result;
  }

  function purchase(item, storeUrl) {
    const individual = safePublicUrl(item.purchaseUrl);
    const unavailable = item.stockStatus === 'soldOut' || item.stockStatus === 'discontinued';
    if (unavailable) return { url: '', label: item.stockStatus === 'soldOut' ? '품절' : '판매 종료', reason: '현재 이 상품은 구매할 수 없습니다.' };
    if (item.stockStatus === 'comingSoon') return { url: '', label: '판매 준비 중', reason: '가격과 미리보기는 확인할 수 있으며 결제·다운로드 연결을 준비하고 있습니다.' };
    if (individual && item.price === 0 && item.stockStatus === 'available') return { url: individual, label: '무료 다운로드', reason: '별도 결제나 로그인 없이 PDF를 바로 받을 수 있습니다.' };
    if (individual && Number.isFinite(item.price) && item.stockStatus === 'available') return { url: individual, label: '구매하기', reason: '실제 판매 채널에서 결제와 제공 조건을 확인합니다.' };
    return { url: safePublicUrl(storeUrl), label: safePublicUrl(storeUrl) ? '스마트스토어 보기' : '판매 준비 중', reason: '개별 상품의 가격과 판매 연결을 준비하고 있습니다.' };
  }

  scope.NALStore = Object.freeze({ types, licenses, topics, audiences, type, digital, searchable, safePublicUrl, preview, filter, purchase });
})(globalThis);
