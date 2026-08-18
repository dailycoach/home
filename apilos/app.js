(()=>{
  const loadCore=()=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/apilos/app-core.js';s.async=false;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
  const setCard=(card,{href,mark,kind,title,note})=>{if(!card)return;card.href=href;const m=card.querySelector('.evidence-source-mark');const copy=card.querySelector('.evidence-source-copy');if(m)m.textContent=mark;if(copy){const els=copy.children;if(els[0])els[0].textContent=kind;if(els[1])els[1].textContent=title;if(els[2])els[2].textContent=note;}};
  const correct=()=>{
    const cards=[...document.querySelectorAll('.evidence-source')];
    if(location.pathname==='/apilos/programs/professional-academy/'){
      setCard(cards[2],{href:'https://blog.naver.com/apilos/224351456999',mark:'BLOG',kind:'OFFICIAL BLOG RSS',title:'제4기 통합상담코칭전문가 양성과정',note:'대면 + 비대면 2 Track · 4강좌'});
    }
    if(location.pathname==='/apilos/programs/pastoral-coaching/'){
      if(cards[0]) cards[0].remove();
      const t=[...document.querySelectorAll('.evidence-timeline-item')][2];if(t){const a=t.querySelector('small'),b=t.querySelector('strong'),c=t.querySelector('span');if(a)a.textContent='VERIFY';if(b)b.textContent='SOURCE CHECK';if(c)c.textContent='세부 운영원문 추가확인';}
    }
    if(location.pathname==='/apilos/programs/professional-network/'){
      setCard(cards[2],{href:'https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002375018',mark:'KCI',kind:'ACADEMIC',title:'학교폭력예방 × 융합상담 연구',note:'안전·상담·학교 현장 연결'});
    }
    if(location.pathname==='/apilos/programs/social-impact/'){
      setCard(cards[0],{href:'https://blog.naver.com/apilos/224339731348',mark:'BLOG',kind:'OFFICIAL BLOG RSS',title:'해피피플 대전지부 × KB캐피탈 자립준비청년 지원',note:'행복드림센터 · 자격증 취득 지원'});
    }
  };
  loadCore().then(()=>{correct();}).catch(()=>{});
})();