// Render only plain text and links to the original Brunchstory articles.
// Feed data is a same-origin, pre-reviewed JSON snapshot, not raw remote HTML.
(() => {
  const lists = [...document.querySelectorAll('[data-brunch-list]')];
  if (!lists.length) return;

  const validBrunchURL = (value) => {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' && url.hostname === 'brunch.co.kr' ? url.href : null;
    } catch { return null; }
  };

  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '브런치 연재'
      : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  };

  const makeCard = (post) => {
    const article = document.createElement('article');
    article.className = 'essays-card';
    const date = document.createElement('small');
    date.textContent = formatDate(post.publishedAt);
    const title = document.createElement('h3');
    title.textContent = String(post.title || '제목 없는 글');
    const summary = document.createElement('p');
    summary.textContent = String(post.summary || '').slice(0, 170);
    const link = document.createElement('a');
    link.href = validBrunchURL(post.link);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '브런치에서 이어 읽기';
    article.append(date, title, summary, link);
    return article;
  };

  async function readFeed() {
    const sources = [
      'https://raw.githubusercontent.com/dailycoach/home/main/maeum-library/assets/brunch-posts.json',
      '/maeum-library/assets/brunch-posts.json',
    ];
    for (const source of sources) {
      try {
        const response = await fetch(source, { cache: 'no-cache' });
        if (!response.ok) continue;
        const payload = await response.json();
        if (Array.isArray(payload.items)) return payload;
      } catch { /* Try the last published snapshot. */ }
    }
    throw new Error('No available Brunch snapshot');
  }

  async function loadPosts() {
    try {
      const payload = await readFeed();
      const posts = Array.isArray(payload.items)
        ? payload.items.filter((item) => item && validBrunchURL(item.link))
        : [];
      const profileURL = validBrunchURL(payload.authorUrl);
      document.querySelectorAll('[data-brunch-profile]').forEach((link) => {
        if (profileURL) { link.href = profileURL; link.hidden = false; }
      });
      for (const list of lists) {
        const limit = Math.max(1, Math.min(20, Number(list.dataset.max) || 20));
        if (!posts.length) {
          list.textContent = '';
          const empty = document.createElement('p');
          empty.className = 'essays-empty';
          empty.textContent = '브런치 연재를 연결하고 있습니다. 새 글이 준비되면 이곳에 표시됩니다.';
          list.append(empty);
          continue;
        }
        list.replaceChildren(...posts.slice(0, limit).map(makeCard));
      }
    } catch {
      for (const list of lists) {
        list.textContent = '';
        const note = document.createElement('p');
        note.className = 'essays-empty';
        note.textContent = '글 목록을 잠시 불러오지 못했습니다. 조금 뒤 다시 확인해 주세요.';
        list.append(note);
      }
    }
  }

  loadPosts();
})();
