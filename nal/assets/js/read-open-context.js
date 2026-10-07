(() => {
 const q=new URLSearchParams(location.search),slug=q.get('season'),view=q.get('view')||'today';
 const daily=new Set(['before','today','journey','day']),workspace=new Set(['try','live','my','report']);
 if(!/^[a-z0-9-]{1,120}$/.test(slug||'')||['admin','auth','open','join'].includes(slug)||(!daily.has(view)&&!workspace.has(view))){
  document.body.dataset.readRouteInvalid='true';document.body.dataset.season='route-unavailable';return;
 }
 document.body.dataset.season=slug;
 if(daily.has(view))document.body.dataset.readDailyPage=view;else document.body.dataset.readWorkspacePage=view;
 document.title=view.toUpperCase()+' | NAL READ';
})();
