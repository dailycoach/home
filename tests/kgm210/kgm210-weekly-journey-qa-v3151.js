(function boot(attempt){
  'use strict';
  attempt=Number(attempt)||0;
  const engine=window.KGMWeeklyJourneyV315;
  const weeklyUi=window.KGM_WEEKLY_JOURNEY_V315;
  if(!engine||!weeklyUi){
    if(attempt<80){setTimeout(()=>boot(attempt+1),125);return;}
    console.warn('[KGM v3.15.2] weekly QA initialization timed out');
    return;
  }
  if(window.KGM_WEEKLY_QA_V3151?.ok)return;

  const VERSION='KGM210 weekly journey QA v3.15.2';
  const by=id=>document.getElementById(id);
  const safeJson=(value,fallback)=>{try{return JSON.parse(value)}catch(error){return fallback}};
  const read=()=>engine.normalize(safeJson(localStorage.getItem(engine.STORAGE_KEY)||'null',null));
  const write=journey=>{try{localStorage.setItem(engine.STORAGE_KEY,JSON.stringify(journey));return true}catch(error){return false}};
  let timer=null;

  function visibleTextCleanup(root=document){
    const pairs=[['7일 성장기록','7주 성장여정'],['7일 기록 시작','7주 성장여정 시작'],['7일 기록','7주 성장여정'],['오늘 기록하기','이번 주 기록하기'],['7일 동안','7주 동안'],['7일 완료','7주 성장통합']];
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(node.parentElement?.closest('script,style,noscript,template,textarea,.weeklyLegacyV315'))return;
      let value=node.nodeValue;
      pairs.forEach(([before,after])=>value=value.split(before).join(after));
      if(value!==node.nodeValue)node.nodeValue=value;
    });
  }

  function values(){
    return {
      pre:{
        scene:by('weeklyPreSceneV315')?.value||'',
        attempt:by('weeklyAttemptV315')?.value||'',
        learning:by('weeklyPreLearningV315')?.value||'',
        agenda:by('weeklyPreAgendaV315')?.value||''
      },
      post:{
        insight:by('weeklyPostInsightV315')?.value||'',
        phrase:by('weeklyPostPhraseV315')?.value||'',
        action:by('weeklyPostActionV315')?.value||'',
        returnPhrase:by('weeklyPostReturnV315')?.value||'',
        nextCheck:by('weeklyPostNextV315')?.value||''
      }
    };
  }

  function indicator(state='saved'){
    const screen=by('weeklyJourneyScreenV315');
    if(!screen)return;
    let element=by('weeklyAutosaveV3151');
    if(!element){
      element=document.createElement('div');
      element.id='weeklyAutosaveV3151';
      element.className='weeklyAutosaveV3151';
      screen.appendChild(element);
    }
    element.textContent=state==='saving'?'저장 중…':state==='error'?'저장 확인 필요':'이 기기에 자동 저장됨';
    element.dataset.state=state;
  }

  function saveNow(){
    const screen=by('weeklyJourneyScreenV315');
    const journey=read();
    if(!screen||screen.classList.contains('hidden')||!journey||journey.status==='completed')return;
    const week=Math.min(journey.currentWeek,Math.max(1,Number(weeklyUi.viewWeek?.())||journey.currentWeek));
    const current=values();
    indicator('saving');
    let next=engine.savePre(journey,week,current.pre);
    next=engine.savePost(next,week,current.post);
    indicator(write(next)?'saved':'error');
  }

  function scheduleSave(){
    clearTimeout(timer);
    indicator('saving');
    timer=setTimeout(saveNow,550);
  }

  function addConversationPreview(root=document){
    const journey=read();
    if(!journey||journey.status==='completed')return;
    const stage=engine.stage(journey.currentWeek);
    const week=engine.getWeek(journey,journey.currentWeek);
    root.querySelectorAll('.weeklyBridgeV315').forEach(card=>{
      let preview=card.querySelector('.weeklyConversationPreviewV3151');
      if(!preview){
        preview=document.createElement('div');
        preview.className='weeklyConversationPreviewV3151';
        card.querySelector('div')?.appendChild(preview);
      }
      const phrase=week?.post?.phrase||week?.pre?.agenda||'이번 대화에서 확인할 한 문장을 아직 정하지 않았습니다.';
      const action=week?.post?.action||'이번 주 작은 행동을 코칭 후에 정합니다.';
      preview.innerHTML=`<span>이번 주 대화 준비</span><b>${stage.key} · ${stage.title}</b><p>${phrase}</p><small>${action}</small>`;
    });
  }

  function hideLegacyDailyControls(){
    const old=by('growthTracker');
    if(old&&old.querySelector('.weeklyBridgeV315'))old.classList.add('weeklyReplacedV315');
    document.querySelectorAll('.trackerStartPanel').forEach(element=>{
      if(!element.querySelector('.weeklyBridgeV315'))element.style.display='none';
    });
  }

  function openSource(button){
    if(button.closest('#result'))return 'result';
    if(button.closest('#journey'))return 'journey';
    return 'intro';
  }

  function interceptWeeklyOpen(event){
    const button=event.target.closest?.('.weeklyOpenV315');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    weeklyUi.open(button.dataset.weeklySource||openSource(button));
  }

  function run(){
    visibleTextCleanup(document);
    hideLegacyDailyControls();
    addConversationPreview(document);
  }

  document.addEventListener('click',interceptWeeklyOpen,true);
  document.addEventListener('input',event=>{
    if(event.target.closest?.('#weeklyJourneyScreenV315')&&(event.target.matches('textarea')||event.target.matches('select')))scheduleSave();
  },true);
  document.addEventListener('change',event=>{
    if(event.target.closest?.('#weeklyJourneyScreenV315'))scheduleSave();
  },true);
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#weeklyCloseV315,#weeklyCompleteWeekV315,#weeklySavePreV315,#weeklySavePostV315'))saveNow();
  },true);
  window.addEventListener('beforeunload',saveNow);
  window.addEventListener('beforeprint',run);
  document.addEventListener('DOMContentLoaded',()=>{
    run();
    [500,1500,3500,7000].forEach(delay=>setTimeout(run,delay));
  });
  try{
    new MutationObserver(()=>{
      clearTimeout(window.__kgmWeeklyQaTimer);
      window.__kgmWeeklyQaTimer=setTimeout(run,120);
    }).observe(document.body,{childList:true,subtree:true});
  }catch(error){}

  run();
  window.KGM_WEEKLY_QA_V3151={
    ok:true,
    version:VERSION,
    attempts:attempt,
    autosave:true,
    beforeUnloadSave:true,
    legacyDailyHidden:true,
    reentryPreview:true,
    visibleSevenDayTermsRewritten:true,
    duplicateOpenGuard:true,
    separateViewedWeek:true,
    storageKey:engine.STORAGE_KEY
  };
})(0);