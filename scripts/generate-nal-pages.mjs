import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const canonicalBase = 'https://daily-coach-ing.com';
const ogImage = `${canonicalBase}/nal/assets/images/nal-og.png`;
const [{ programs }, { products }, { hosts }, { content }] = await Promise.all([
  readFile(path.join(root, 'nal/data/programs.json'), 'utf8').then(JSON.parse),
  readFile(path.join(root, 'nal/data/products.json'), 'utf8').then(JSON.parse),
  readFile(path.join(root, 'nal/data/hosts.json'), 'utf8').then(JSON.parse),
  readFile(path.join(root, 'nal/data/content.json'), 'utf8').then(JSON.parse)
]);

const pages = [
  {
    route: '/nal/',
    attrs: 'data-page="home"',
    title: '날빛 | NAL 커뮤니티·원데이클래스·감정카드',
    description: '취향과 마음을 주제로 만나는 커뮤니티와 원데이클래스, 감정카드·질문카드·워크북을 소개하는 NAL 플랫폼입니다.',
    label: 'NAL / CURATED COMMUNITY',
    heading: '오늘, 조금 다른 사람들과\n조금 더 나다운 시간을.',
    copy: '취향과 마음이 만나는 커뮤니티와 원데이클래스, 그리고 일상에서 사용하는 감정·코칭 도구.',
    schemaType: 'WebSite'
  },
  {
    route: '/nal/gather/', attrs: 'data-page="listing" data-collection="programs" data-type="gather"',
    title: '모임 | NAL GATHER · 날빛', description: 'NAL이 검토한 커뮤니티와 소모임을 주제와 방식에 따라 찾아보세요.',
    label: 'NAL GATHER', heading: '계속 만나며\n조금씩 달라지는 모임', copy: '정기·시즌·자유·온라인 모임을 현재 모집 상태와 함께 확인합니다.', schemaType: 'CollectionPage'
  },
  {
    route: '/nal/class/', attrs: 'data-page="listing" data-collection="programs" data-type="class"',
    title: '원데이클래스 | NAL CLASS · 날빛', description: '마음, 관계, 미술, 글쓰기, 라이프, 커리어를 주제로 한 NAL 원데이클래스를 살펴보세요.',
    label: 'NAL CLASS', heading: '한 번의 참여로\n새로운 장면을 여는 시간', copy: '혼자 와도 괜찮은 클래스부터 도구를 직접 써보는 워크숍까지 큐레이션합니다.', schemaType: 'CollectionPage'
  },
  {
    route: '/nal/shop/', attrs: 'data-page="listing" data-collection="products"',
    title: '감정카드·질문카드 | NAL SHOP · 날빛', description: '감정카드, 질문카드, 관계카드, 강점·가치카드와 워크북을 살펴보세요.',
    label: 'NAL SHOP', heading: '말로 꺼내기 어려운 마음을\n한 장의 카드에서', copy: '감정을 발견하고 대화를 시작하며 생각을 기록하는 자기이해 도구를 소개합니다.', schemaType: 'CollectionPage'
  },
  {
    route: '/nal/note/', attrs: 'data-page="listing" data-collection="content"',
    title: '콘텐츠 | NAL NOTE · 날빛', description: '마음, 관계, 모임 이야기와 감정·질문카드 활용법을 전하는 NAL 콘텐츠입니다.',
    label: 'NAL NOTE', heading: '읽고 끝나지 않는\n다음 경험의 기록', copy: '관심 주제에서 관련 모임과 실제로 사용할 도구까지 가볍게 이어집니다.', schemaType: 'CollectionPage'
  },
  {
    route: '/nal/host/', attrs: 'data-page="listing" data-collection="hosts"',
    title: '진행자 | NAL HOST · 날빛', description: 'NAL이 검토한 진행자와 그들이 운영하는 프로그램의 방식과 전문 영역을 확인하세요.',
    label: 'NAL HOST', heading: '자격보다 먼저\n어떻게 진행하는지', copy: '사람을 단정하지 않고 참여자의 선택권을 존중하는 진행자를 소개합니다.', schemaType: 'CollectionPage'
  },
  {
    route: '/nal/my/', attrs: 'data-page="my"',
    title: 'MY NAL | 날빛', description: '이 기기에서 찜한 모임과 상품, 최근 본 항목을 확인합니다.',
    label: 'MY NAL / LOCAL', heading: '내가 남겨둔\nNAL의 장면들', copy: '로그인 없이 이 기기에만 저장된 찜과 최근 본 항목을 확인할 수 있습니다.', schemaType: 'WebPage', noindex: true
  },
  {
    route: '/nal/search/', attrs: 'data-page="search"',
    title: '검색 | NAL · 날빛', description: 'NAL 모임, 클래스, 도구, 진행자와 콘텐츠를 검색합니다.',
    label: 'NAL SEARCH', heading: '지금 필요한 경험을\n한 번에 찾아보세요', copy: '주제, 프로그램, 도구 또는 진행자 이름으로 검색할 수 있습니다.', schemaType: 'SearchResultsPage', noindex: true
  }
];

const detailSets = [
  {
    base: '/nal/gather/', collection: 'programs', type: 'gather', label: 'NAL GATHER',
    publicSlugs: [],
    slugs: {
      'emotion-card-conversation': ['감정카드 대화모임', '감정카드를 매개로 자신의 마음을 발견하고 대화를 시작하는 커뮤니티 초안입니다.'],
      'self-understanding-writing': ['자기이해 글쓰기 모임', '글을 통해 자신의 생각과 삶의 장면을 천천히 살펴보는 커뮤니티 초안입니다.'],
      'coaches-dialogue-practice': ['코치들의 대화와 실습 모임', '코치들이 실제 대화 장면을 나누고 함께 실습하는 커뮤니티 초안입니다.']
    }
  },
  {
    base: '/nal/class/', collection: 'programs', type: 'class', label: 'NAL CLASS',
    publicSlugs: ['art-psychology-coaching-6week'],
    slugs: {
      'art-psychology-coaching-6week': ['미술심리코칭 6주 과정', '색과 형태로 표현하고 자신의 언어로 읽으며 다음 행동으로 연결하는 6주 과정입니다.'],
      'meet-myself-with-emotion-cards': ['감정카드로 만나는 나', '감정카드를 활용해 현재의 마음을 발견하고 기록하는 원데이클래스 초안입니다.'],
      'art-current-mind': ['미술로 그리는 현재의 마음', '잘 그리는 법보다 현재의 선과 색을 관찰하는 미술 원데이클래스 초안입니다.'],
      'relationship-dialogue-style': ['관계 속 나의 대화 방식', '관계 장면에서 반복되는 대화 방식을 살펴보는 원데이클래스 초안입니다.'],
      'direction-collage': ['올해의 방향 콜라주', '이미지와 문장을 조합해 삶의 방향을 한 장면으로 구성하는 원데이클래스 초안입니다.'],
      'my-sentence-question-card': ['질문카드로 만드는 나만의 문장', '질문카드를 따라 자신에게 필요한 문장을 발견하는 원데이클래스 초안입니다.']
    }
  },
  {
    base: '/nal/shop/', collection: 'products', label: 'NAL SHOP',
    publicSlugs: [],
    slugs: {
      'emotion-cards': ['감정카드', '말로 꺼내기 어려운 감정을 발견하고 표현을 시작하도록 돕는 카드 도구 초안입니다.'],
      'coaching-question-cards': ['코칭 질문카드', '생각을 기록하고 다음 관점을 살펴보는 질문카드 초안입니다.'],
      'relationship-question-cards': ['관계 질문카드', '커플·가족·모임의 대화를 시작하도록 돕는 질문카드 초안입니다.'],
      'strength-cards': ['강점카드', '자신이 자주 사용하는 힘과 가능성을 발견하도록 돕는 카드 초안입니다.'],
      'value-cards': ['가치카드', '중요하게 여기는 방향을 삶의 장면과 연결하는 카드 초안입니다.'],
      'emotion-record-workbook': ['감정 기록 워크북', '감정을 발견하고 생각을 기록하는 워크북 초안입니다.'],
      'art-psychology-workbook': ['미술심리 워크북', '그림을 진단하지 않고 작품을 바라보며 자기 언어를 기록하는 워크북 초안입니다.'],
      'oneday-class-kit': ['원데이클래스 키트', '진행자와 참여자가 클래스에서 함께 사용하는 도구 구성 초안입니다.']
    }
  },
  {
    base: '/nal/host/', collection: 'hosts', label: 'NAL HOST',
    publicSlugs: ['park-jia', 'kim-cheol-woong'],
    slugs: {
      'park-jia': ['박지아 코치', '예술적 표현을 단정하지 않고 참여자의 언어와 다음 선택으로 연결하는 진행자입니다.'],
      'kim-cheol-woong': ['김철웅 코치', '코칭 대화와 자기이해 도구를 실제 삶의 다음 행동으로 연결하는 진행자입니다.']
    }
  }
];

pages.push({
  route: '/nal/note/art-psychology-coaching-guide/',
  attrs: 'data-page="detail" data-collection="content" data-slug="art-psychology-coaching-guide"',
  title: '미술심리코칭 6주 과정 참여 안내 | NAL NOTE · 날빛',
  description: '미술심리코칭 6주 과정의 참여 방식, 준비물, 진행자, FAQ와 과정 범위를 안내합니다.',
  label: 'NAL NOTE',
  heading: '미술심리코칭 6주 과정 참여 안내',
  copy: '과정 원문에서 확인된 참여 방식과 안전 범위를 연결합니다.',
  schemaType: 'WebPage'
});

for (const set of detailSets) {
  for (const [slug, [heading, description]] of Object.entries(set.slugs)) {
    if (!set.publicSlugs.includes(slug)) continue;
    pages.push({
      route: `${set.base}${slug}/`,
      attrs: `data-page="detail" data-collection="${set.collection}"${set.type ? ` data-type="${set.type}"` : ''} data-slug="${slug}"`,
      title: `${heading} | ${set.label} · 날빛`, description,
      label: set.label, heading, copy: '확정되지 않은 일정·가격·정원 정보는 공개하지 않습니다. 현재 등록 상태를 확인해 주세요.', schemaType: 'WebPage'
    });
  }
}

const infoPages = [
  ['/nal/notice/', 'notice', '공지사항', 'NAL NOTICE', '운영 공지는 확인된 내용만 게시합니다.', false],
  ['/nal/faq/', 'faq', '자주 묻는 질문', 'NAL FAQ', '신청·참여·도구 구매 전에 필요한 기준을 확인하세요.', false],
  ['/nal/partnership/', 'partnership', '입점·제휴 문의', 'NAL PARTNERSHIP', 'NAL의 큐레이션 기준에 맞는 프로그램·도구·콘텐츠 협업을 검토합니다.', false],
  ['/nal/policy/terms/', 'terms', '이용약관', 'NAL POLICY', '법적 검토와 운영자 정보 확정 후 정식 약관을 공개합니다.', true],
  ['/nal/policy/privacy/', 'privacy', '개인정보처리방침', 'NAL POLICY', '수집 항목과 처리 주체가 확정되기 전 개인정보 입력을 받지 않습니다.', true],
  ['/nal/policy/cancellation/', 'cancellation', '취소·환불 규정', 'NAL POLICY', '프로그램별 실제 조건과 판매 채널의 정책이 확정된 뒤 공개합니다.', true],
  ['/nal/policy/shipping/', 'shipping', '배송·교환 안내', 'NAL POLICY', '판매 상품과 배송 운영 방식이 확정된 뒤 공개합니다.', true]
];

for (const [route, section, heading, label, copy, noindex] of infoPages) {
  pages.push({
    route, attrs: `data-page="info" data-section="${section}"`,
    title: `${heading} | NAL · 날빛`, description: copy, label, heading, copy,
    schemaType: section === 'faq' ? 'FAQPage' : 'WebPage', noindex
  });
}

function jsonLd(page) {
  const base = {
    '@context': 'https://schema.org',
    '@type': page.schemaType,
    name: page.heading.replaceAll('\n', ' '),
    url: `${canonicalBase}${page.route}`,
    description: page.description,
    isPartOf: {
      '@type': 'WebSite',
      name: '날빛',
      alternateName: 'NAL',
      url: `${canonicalBase}/nal/`
    }
  };
  return JSON.stringify(base).replaceAll('<', '\\u003c');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function itemRoute(collection, item) {
  if (collection === 'programs') return `/nal/${item.type}/${item.slug}/`;
  if (collection === 'products') return `/nal/shop/${item.slug}/`;
  if (collection === 'hosts') return `/nal/host/${item.slug}/`;
  return `/nal/note/${item.slug}/`;
}

function fallbackExtras(page) {
  if (page.route === '/nal/') {
    return `<section class="nal-section nal-static-fallback" aria-label="NAL 핵심 영역">
      <div class="nal-container">
        <div class="nal-grid nal-grid--three">
          <a class="nal-card nal-card--gather" href="/nal/gather/"><span>NAL GATHER</span><strong>커뮤니티와 소모임</strong></a>
          <a class="nal-card nal-card--class" href="/nal/class/"><span>NAL CLASS</span><strong>원데이클래스와 워크숍</strong></a>
          <a class="nal-card nal-card--product" href="/nal/shop/"><span>NAL SHOP</span><strong>감정카드와 자기이해 도구</strong></a>
        </div>
      </div>
    </section>`;
  }

  const collectionName = page.attrs.match(/data-collection="([^"]+)"/)?.[1];
  const pageType = page.attrs.match(/data-type="([^"]+)"/)?.[1];
  const slug = page.attrs.match(/data-slug="([^"]+)"/)?.[1];
  const collections = { programs, products, hosts, content };
  if (!collectionName || !collections[collectionName]) return '';

  if (page.attrs.includes('data-page="listing"')) {
    let items = collections[collectionName].filter((item) => item.published);
    if (pageType) items = items.filter((item) => item.type === pageType);
    if (!items.length) {
      return '<section class="nal-section nal-static-fallback"><div class="nal-container"><p class="nal-empty">현재 공개된 항목이 없습니다. 확인된 정보가 준비되면 이곳에 안내합니다.</p></div></section>';
    }
    return `<section class="nal-section nal-static-fallback" aria-label="공개 항목"><div class="nal-container"><ul class="nal-static-list">${items.map((item) => `<li><a href="${itemRoute(collectionName, item)}"><strong>${escapeHtml(item.title ?? item.name)}</strong><span>${escapeHtml(item.summary ?? item.headline)}</span></a></li>`).join('')}</ul></div></section>`;
  }

  if (page.attrs.includes('data-page="detail"') && slug) {
    const item = collections[collectionName].find((entry) => entry.slug === slug && entry.published);
    if (!item) return '';
    const source = item.sourceUrl ? `<a class="nal-button nal-button--secondary" href="${escapeHtml(item.sourceUrl)}">확인된 원문 보기</a>` : '';
    return `<section class="nal-section nal-static-fallback"><div class="nal-container nal-prose"><p>${escapeHtml(item.summary ?? item.headline ?? item.description)}</p>${source}</div></section>`;
  }
  return '';
}

function html(page) {
  const heading = page.heading.split('\n').join('<br>');
  const robots = page.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large';
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="light">
  <meta name="theme-color" content="#F5F1E8">
  <meta name="robots" content="${robots}">
  <title>${page.title}</title>
  <meta name="description" content="${page.description}">
  <link rel="canonical" href="${canonicalBase}${page.route}">
  <link rel="icon" href="/nal/assets/images/nal-symbol.svg" type="image/svg+xml">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="날빛">
  <meta property="og:title" content="${page.title}">
  <meta property="og:description" content="${page.description}">
  <meta property="og:url" content="${canonicalBase}${page.route}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="NAL 커뮤니티·원데이클래스·감정도구 플랫폼">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="stylesheet" href="/nal/assets/css/nal.css">
  <script type="application/ld+json">${jsonLd(page)}</script>
  <script src="/nal/assets/js/app.js" defer></script>
</head>
<body ${page.attrs}>
  <a class="nal-skip-link" href="#main-content">본문으로 바로가기</a>
  <div data-site-header></div>
  <main id="main-content" data-page-root tabindex="-1">
    <section class="nal-page-intro">
      <div class="nal-container">
        <p class="nal-eyebrow">${page.label}</p>
        <h1>${heading}</h1>
        <p>${page.copy}</p>
      </div>
    </section>
${fallbackExtras(page)}
  </main>
  <div data-mobile-cta></div>
  <div data-site-footer></div>
  <div class="nal-toast" data-toast role="status" aria-live="polite" aria-atomic="true"></div>
  <noscript><p class="nal-noscript">NAL의 목록과 상세 정보를 보려면 브라우저에서 JavaScript를 사용해 주세요.</p></noscript>
</body>
</html>
`;
}

for (const page of pages) {
  const file = path.join(root, page.route.replace(/^\//, ''), 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html(page), 'utf8');
}

await mkdir(path.join(root, 'nal/data'), { recursive: true });
await writeFile(
  path.join(root, 'nal/data/routes.json'),
  `${JSON.stringify({
    schemaVersion: '1.0',
    routes: pages.map((page) => ({
      path: page.route,
      title: page.title,
      description: page.description,
      indexable: !page.noindex
    }))
  }, null, 2)}\n`,
  'utf8'
);

console.log(`Generated ${pages.length} NAL pages.`);
