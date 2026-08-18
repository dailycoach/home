(() => {
  const grid = document.querySelector('[data-archive-live-grid]');
  const toolbar = document.querySelector('[data-archive-filters]');
  const updated = document.querySelector('[data-archive-updated]');
  const count = document.querySelector('[data-archive-count]');
  if (!grid) return;

  const labels = {
    all: '전체', academy: '전문가교육', youth: '청소년·학교', pastoral: '목회·기독교',
    social: '사회공헌', network: '학회·네트워크', knowledge: '연구·출판', field: '기타 현장'
  };

  const keywords = {
    academy: ['전문가', '양성과정', '커리어컨설턴트', '자기주도학습코치', '심리검사전문가', 'nlp', '코치 양성', '교육과정'],
    youth: ['청소년', '진로', '학습', '중학교', '학교', '리빙랩', '캠프', '조이스쿨', '부모', '학생'],
    pastoral: ['목회', '교회', '기독교', '사역', '다음세대', '신앙', '크리스챤'],
    social: ['해피피플', '행복드림', '사회공헌', '공익', 'esg', '안전', '봉사', 'ngo', '다문화', '자립준비청년'],
    network: ['학회', '상담인상', '전문상담', '임상감독', '상담학회', '자격'],
    knowledge: ['심리상담뉴스', '창간', '연구', '학술', '저서', '책', '출판', '교재', '미디어']
  };

  const classify = post => {
    const text = `${post.title || ''} ${post.summary || ''}`.toLowerCase();
    let best = 'field', score = 0;
    for (const [cat, words] of Object.entries(keywords)) {
      const current = words.reduce((sum, word) => sum + (text.includes(word.toLowerCase()) ? 1 : 0), 0);
      if (current > score) { best = cat; score = current; }
    }
    return best;
  };

  const formatDate = value => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('ko-KR', {year:'numeric',month:'2-digit',day:'2-digit'})
      .format(d).replace(/\. /g,'.').replace(/\.$/,'');
  };

  const shorten = (value, max = 125) => {
    const text = String(value || '').replace(/\s+/g,' ').trim();
    return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
  };

  const render = posts => {
    const categories = {};
    const cards = posts.map(post => {
      const cat = classify(post);
      categories[cat] = (categories[cat] || 0) + 1;
      const article = document.createElement('article');
      article.className = 'archive-live-card';
      article.dataset.cat = cat;
      article.innerHTML = `
        <div class="archive-live-meta"><span>${labels[cat]}</span><time>${formatDate(post.publishedAt)}</time></div>
        <h3></h3><p></p><a target="_blank" rel="noopener noreferrer">공식 원문 보기 ↗</a>`;
      article.querySelector('h3').textContent = post.title || '';
      article.querySelector('p').textContent = shorten(post.summary);
      article.querySelector('a').href = post.url;
      return article;
    });
    grid.replaceChildren(...cards);
    if (count) count.textContent = `${posts.length} RECORDS`;

    if (toolbar) {
      toolbar.querySelectorAll('[data-filter]').forEach(btn => {
        const cat = btn.dataset.filter;
        const n = cat === 'all' ? posts.length : (categories[cat] || 0);
        const counter = btn.querySelector('span');
        if (counter) counter.textContent = n;
      });
    }
  };

  const applyFilter = cat => {
    grid.querySelectorAll('.archive-live-card').forEach(card => {
      card.hidden = cat !== 'all' && card.dataset.cat !== cat;
    });
    if (toolbar) toolbar.querySelectorAll('[data-filter]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.filter === cat);
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === cat));
    });
  };

  if (toolbar) toolbar.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    applyFilter(btn.dataset.filter);
  });

  fetch('/apilos/news/blog.json?ts=' + Date.now(), {cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error('feed'); return r.json(); })
    .then(data => {
      const posts = Array.isArray(data.posts) ? data.posts : [];
      if (!posts.length) throw new Error('empty');
      render(posts);
      if (updated && data.updatedAt) updated.textContent = `RSS ${formatDate(data.updatedAt)} 갱신`;
      applyFilter('all');
    })
    .catch(() => {
      grid.innerHTML = '<div class="archive-empty">LIVE RSS 기록을 불러오는 중입니다. 상단의 검증된 현장·사업 기록은 정상적으로 이용할 수 있습니다.</div>';
      if (updated) updated.textContent = 'RSS 갱신 대기';
    });
})();
