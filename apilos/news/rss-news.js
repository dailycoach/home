(() => {
  const grid = document.querySelector('[data-rss-news-grid]');
  const error = document.querySelector('[data-rss-news-error]');
  const status = document.querySelector('[data-journal-status]');
  if (!grid) return;

  const formatDate = value => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' }).format(date).replace(/\. /g,'.').replace(/\.$/,'');
  };
  const make = (tag, text) => { const el=document.createElement(tag); if(text!=null) el.textContent=text; return el; };
  const renderPost = (post, index) => {
    const article = make('article');
    if (index === 0) article.classList.add('is-lead');
    const meta = make('div');
    const category = make('span', post.category || 'OFFICIAL BLOG');
    const time = make('time', formatDate(post.publishedAt));
    if (post.publishedAt) time.dateTime = new Date(post.publishedAt).toISOString();
    meta.append(category,time);
    const title=make('h2',post.title||'');
    const summary=make('p',post.summary||'');
    const link=make('a','원문 읽기 ↗');
    link.href=post.url; link.target='_blank'; link.rel='noopener noreferrer';
    article.append(meta,title,summary,link);
    return article;
  };

  fetch('/apilos/news/blog.json?ts=' + Date.now(), { cache:'no-store' })
    .then(response => { if(!response.ok) throw new Error(String(response.status)); return response.json(); })
    .then(data => {
      const posts = Array.isArray(data.posts) ? data.posts.slice(0,4) : [];
      if(!posts.length) throw new Error('empty');
      grid.replaceChildren(...posts.map(renderPost));
      grid.removeAttribute('data-rss-fallback');
      if(error) error.hidden=true;
      if(status){
        const updated = data.updatedAt ? formatDate(data.updatedAt) : '';
        status.textContent = `${posts.length}개 최신 기록${updated ? ' · RSS '+updated+' 갱신' : ''}`;
      }
    })
    .catch(() => {
      if(error) error.hidden=false;
      if(status) status.textContent='저장된 기록 표시 중';
    });
})();
