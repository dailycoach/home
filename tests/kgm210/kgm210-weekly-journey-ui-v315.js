(function(){
  'use strict';

  const engine=window.KGMWeeklyJourneyV315;
  if(!engine){
    console.warn('[KGM v3.15] weekly journey engine not found');
    return;
  }

  const VERSION='KGM210 weekly journey UI v3.15.2';
  const by=id=>document.getElementById(id);
  const qsa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));
  const safeJson=(value,fallback)=>{try{return JSON.parse(value)}catch(error){return fallback}};
  const read=()=>engine.normalize(safeJson(localStorage.getItem(engine.STORAGE_KEY)||'null',null));
  const write=journey=>{
    try{
      localStorage.setItem(engine.STORAGE_KEY,JSON.stringify(journey));
      return true;
    }catch(error){
      alert('7주 성장여정을 저장하지 못했습니다. 브라우저 저장공간을 확인해주세요.');
      return false;
    }
  };
  const profile=()=>window.KGM_CURRENT_PROFILE_V314||{};
  const fmt=iso=>{
    try{return new Date(iso).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'})}
    catch(error){return iso||''}
  };
  const field=(id,label,value='',placeholder='')=>`<label class="weeklyFieldV315"><span>${esc(label)}</span><textarea id="${id}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;
  const selectAttempt=value=>`<label class="weeklyFieldV315"><span>지난 작은 행동을 해본 정도</span><select id="weeklyAttemptV315">${['충분히 해봄','조금 해봄','하지 못함','아직 정하지 않음'].map(option=>`<option ${option===value?'selected':''}>${option}</option>`).join('')}</select></label>`;

  let returnView='intro';
  let viewedWeek=null;

  function track(event,properties={}){
    try{
      const key='kgm210:analytics-queue:v1';
      const queue=safeJson(localStorage.getItem(key)||'[]',[]);
      const clean={};
      ['week','stage','status','gapDays','profileCode','source'].forEach(name=>{
        if(properties[name]!==undefined)clean[name]=properties[name];
      });
      queue.push({event,at:new Date().toISOString(),journeyVersion:VERSION,...clean});
      localStorage.setItem(key,JSON.stringify(queue.slice(-300)));
    }catch(error){}
  }

  function legacyCount(){
    return engine.legacyDailyCount(safeJson(localStorage.getItem(engine.LEGACY_KEY)||'null',null));
  }

  function currentResultMeta(){
    const current=profile();
    return {
      profileCode:current.profileCode||'',
      profileName:current.displayName||'',
      resultDate:new Date().toISOString()
    };
  }

  function ensureScreen(){
    if(by('weeklyJourneyScreenV315'))return by('weeklyJourneyScreenV315');
    const parent=document.querySelector('main')||document.querySelector('.app')||document.body;
    const section=document.createElement('section');
    section.id='weeklyJourneyScreenV315';
    section.className='card hidden weeklyJourneyScreenV315';
    parent.appendChild(section);
    return section;
  }

  function hideKnown(){
    ['intro','test','domainComplete','journey','resultTransition','result'].forEach(id=>by(id)?.classList.add('hidden'));
  }

  function visibleSource(){
    if(by('result')&&!by('result').classList.contains('hidden'))return 'result';
    if(by('journey')&&!by('journey').classList.contains('hidden'))return 'journey';
    return 'intro';
  }

  function selectedWeek(journey){
    if(!journey)return 1;
    const unlocked=Math.min(engine.MAX_WEEKS,Math.max(1,Number(journey.currentWeek)||1));
    const selected=Math.min(unlocked,Math.max(1,Number(viewedWeek)||unlocked));
    return selected;
  }

  function openWeekly(source='unknown'){
    returnView=['result','journey','intro'].includes(source)?source:visibleSource();
    viewedWeek=null;
    hideKnown();
    const screen=ensureScreen();
    screen.classList.remove('hidden');

    let journey=read();
    if(journey){
      const noted=engine.noteReturn(journey);
      journey=noted.journey;
      write(journey);
      if(noted.returned){
        track('kgm_week_return_after_gap',{
          week:journey.currentWeek,
          stage:engine.stage(journey.currentWeek).key,
          gapDays:noted.gapDays,
          profileCode:journey.profileCode,
          source
        });
      }
    }

    renderScreen();
    window.scrollTo({top:0,behavior:'smooth'});
    track('kgm_weekly_journey_opened',{
      week:journey?.currentWeek||0,
      stage:journey?engine.stage(journey.currentWeek).key:'',
      profileCode:journey?.profileCode||profile().profileCode||'',
      source
    });
  }

  function closeWeekly(){
    by('weeklyJourneyScreenV315')?.classList.add('hidden');
    viewedWeek=null;
    if(returnView==='result'&&typeof showResult==='function')showResult(false);
    else if(returnView==='journey'&&typeof showJourney==='function')showJourney();
    else if(typeof showIntro==='function')showIntro();
    else by('intro')?.classList.remove('hidden');
  }

  function startHtml(){
    const current=profile();
    const legacy=legacyCount();
    return `<div class="weeklyHeadV315"><div><span>7-WEEK KINGDOM JOURNEY</span><h2>7주 성장여정을 시작합니다</h2><p>한 번 검사하고 혼자 체크하는 방식이 아니라, 7주 동안 주 1회 대화하며 K-I-N-G-D-O-M의 흐름을 삶의 장면에서 확인합니다.</p></div><button id="weeklyCloseV315" class="ghost">돌아가기</button></div><div class="weeklyIntroGridV315"><div><b>검사 결과</b><strong>${esc(current.displayName||'현재 성장프로필')}</strong><span>${esc(current.profileCode||'결과와 연결해 시작합니다')}</span></div><div><b>운영 방식</b><strong>주 1회 · 총 7회</strong><span>검사 → 결과대화 → 7주 코칭 → 성장통합 → 재검사</span></div></div>${legacy?`<div class="weeklyLegacyV315"><b>기존 7일 기록 ${legacy}건은 삭제하지 않습니다.</b><span>새 7주 여정으로 자동 환산하지 않고 참고기록으로 보관합니다.</span></div>`:''}<div class="weeklyStartFormV315">${field('weeklyThemeV315','7주 동안 다룰 성장주제','', '예: 책임을 다 떠안는 장면에서 내 몫을 구분하기')}${field('weeklySuccessV315','7주가 끝났을 때 확인하고 싶은 변화','', '예: 필요한 기준을 말하고 타인의 몫을 돌려줄 수 있다')}<button id="weeklyStartV315" class="primary wide">7주 성장여정 시작</button></div><div class="weeklyStagesV315">${engine.STAGES.map(stage=>`<div><span>${stage.week}주차</span><b>${stage.key} · ${esc(stage.title)}</b><p>${esc(stage.focus)}</p></div>`).join('')}</div>`;
  }

  function weekHtml(journey){
    const progress=engine.progress(journey);
    const displayWeek=selectedWeek(journey);
    const week=engine.getWeek(journey,displayWeek);
    const stage=engine.stage(displayWeek);
    const revisiting=displayWeek<journey.currentWeek;

    return `<div class="weeklyHeadV315"><div><span>WEEK ${week.week} · ${stage.key}</span><h2>${week.week}주차 · ${esc(stage.title)}</h2><p>${esc(stage.focus)}</p></div><button id="weeklyCloseV315" class="ghost">돌아가기</button></div><div class="weeklyProgressV315"><div><b>${progress.completed}/7회 완료</b><span>${esc(journey.growthTheme)}</span></div><i><u style="width:${progress.pct}%"></u></i><small>${esc(journey.successCriterion)}</small></div><nav class="weeklyStepNavV315">${engine.STAGES.map(item=>`<button data-week="${item.week}" class="${item.week===displayWeek?'on':''} ${journey.weeks[item.week-1].completedAt?'done':''}" ${item.week>journey.currentWeek?'disabled':''}><span>${item.week}</span><b>${item.key}</b></button>`).join('')}</nav>${revisiting?`<div class="weeklyReturnV315"><b>${displayWeek}주차 기록을 다시 보고 있습니다.</b><span>수정한 내용은 저장되지만 현재 진행주차 ${journey.currentWeek}주는 유지됩니다.</span></div>`:''}${journey.returnCount?`<div class="weeklyReturnV315"><b>${journey.returnCount}번 다시 돌아왔습니다.</b><span>중단은 실패가 아니라 다음 대화의 자료입니다.</span></div>`:''}<div class="weeklyRecordColumnsV315"><section><span>COACHING BEFORE</span><h3>코칭 전 기록</h3><p>지난 실제 장면을 가져오고, 오늘 코치와 다루고 싶은 것을 정리합니다.</p>${field('weeklyPreSceneV315','지난주에 실제로 있었던 장면',week.pre.scene,'사람·시간·상황이 보이도록 한 장면만 적습니다.')}${selectAttempt(week.pre.attempt)}${field('weeklyPreLearningV315','그 과정에서 알게 된 것',week.pre.learning,'하지 못했다면 무엇이 방해했는지 적어도 좋습니다.')}${field('weeklyPreAgendaV315','오늘 코치와 이야기하고 싶은 것',week.pre.agenda,'오늘 대화에서 놓치고 싶지 않은 지점')}<button id="weeklySavePreV315" class="ghost wide">코칭 전 기록 저장</button></section><section><span>COACHING AFTER</span><h3>코칭 후 기록</h3><p>오늘의 배움을 한 문장과 작은 행동으로 삶에 가져갑니다.</p>${field('weeklyPostInsightV315','오늘 새롭게 알게 된 것',week.post.insight,'대화 전과 달라진 생각이나 알아차림')}${field('weeklyPostPhraseV315','이번 주에 가져갈 한 문장',week.post.phrase,stage.record)}${field('weeklyPostActionV315',week.week===7?'다음 성장으로 가져갈 행동':'이번 주 작은 행동',week.post.action,week.week===7?'7주 이후에도 이어갈 한 가지':'다음 대화 전까지 실제로 확인할 한 가지')}${field('weeklyPostReturnV315','흔들릴 때 돌아올 복귀문장',week.post.returnPhrase,'예: 하지 못한 날도 다음 장면에서 다시 시작할 수 있다')}${field('weeklyPostNextV315','다음 대화에서 확인할 것',week.post.nextCheck,'실제 장면·언어·행동 중 무엇을 확인할지')}<button id="weeklySavePostV315" class="ghost wide">코칭 후 기록 저장</button><button id="weeklyCompleteWeekV315" class="primary wide">${revisiting?'수정 기록 저장하고 현재 주차로':week.week===7?'7주 성장통합 완료':'이번 주 완료하고 다음 주로'}</button></section></div>`;
  }

  function completeHtml(journey){
    const summary=engine.completionSummary(journey);
    return `<div class="weeklyHeadV315"><div><span>7-WEEK COMPLETE</span><h2>7주 성장통합</h2><p>점수 변화뿐 아니라 자기언어, 실제 장면, 작은 행동과 복귀의 변화를 함께 읽습니다.</p></div><button id="weeklyCloseV315" class="ghost">돌아가기</button></div><div class="weeklyCompleteHeroV315"><span>${esc(journey.profileName||'성장프로필')} · ${esc(journey.profileCode||'')}</span><h3>${esc(journey.growthTheme)}</h3><p>${esc(journey.successCriterion)}</p><div><b>시작 ${fmt(journey.startedAt)}</b><b>완료 ${fmt(journey.completedAt)}</b><b>복귀 ${journey.returnCount}회</b></div></div><div class="weeklyLanguageCompareV315"><div><span>초기 언어</span><b>${esc(summary.initialPhrase||'첫 주 기록에서 확인합니다.')}</b></div><div><span>7주 후 언어</span><b>${esc(summary.finalPhrase||'마지막 주 기록에서 확인합니다.')}</b></div></div><div class="weeklyTimelineV315">${summary.weeklyPhrases.map(item=>`<div><span>${item.week}주차 · ${item.key}</span><b>${esc(item.title)}</b><p>${esc(item.phrase||'기록 없음')}</p><small>${esc(item.action||'')}</small></div>`).join('')}</div><div class="weeklyCompleteActionsV315"><button id="weeklyPrepareRetestV315" class="primary">재검사 준비</button><button id="weeklyRestartV315" class="ghost">새 7주 여정 시작</button></div>`;
  }

  function renderScreen(){
    const screen=ensureScreen();
    const journey=read();
    screen.innerHTML=!journey?startHtml():(journey.status==='completed'?completeHtml(journey):weekHtml(journey));
    bindScreen();
  }

  function values(ids){
    const output={};
    Object.entries(ids).forEach(([key,id])=>output[key]=by(id)?.value||'');
    return output;
  }

  function preValues(){
    return values({
      scene:'weeklyPreSceneV315',attempt:'weeklyAttemptV315',learning:'weeklyPreLearningV315',agenda:'weeklyPreAgendaV315'
    });
  }

  function postValues(){
    return values({
      insight:'weeklyPostInsightV315',phrase:'weeklyPostPhraseV315',action:'weeklyPostActionV315',returnPhrase:'weeklyPostReturnV315',nextCheck:'weeklyPostNextV315'
    });
  }

  function bindScreen(){
    by('weeklyCloseV315')?.addEventListener('click',closeWeekly);

    by('weeklyStartV315')?.addEventListener('click',()=>{
      const growthTheme=by('weeklyThemeV315')?.value.trim();
      const successCriterion=by('weeklySuccessV315')?.value.trim();
      if(!growthTheme||!successCriterion){
        alert('7주 성장주제와 성공기준을 모두 적어주세요.');
        return;
      }
      const meta=currentResultMeta();
      const journey=engine.createJourney({...meta,growthTheme,successCriterion,legacyDailyCount:legacyCount()});
      viewedWeek=null;
      write(journey);
      track('kgm_weekly_journey_started',{week:1,stage:'K',profileCode:journey.profileCode,source:'screen'});
      renderScreen();
    });

    by('weeklySavePreV315')?.addEventListener('click',()=>{
      let journey=read();
      const week=selectedWeek(journey);
      journey=engine.savePre(journey,week,preValues());
      write(journey);
      track('kgm_week_pre_saved',{week,stage:engine.stage(week).key,profileCode:journey.profileCode,source:'screen'});
      alert('코칭 전 기록을 저장했습니다.');
    });

    by('weeklySavePostV315')?.addEventListener('click',()=>{
      let journey=read();
      const week=selectedWeek(journey);
      journey=engine.savePost(journey,week,postValues());
      write(journey);
      track('kgm_week_post_saved',{week,stage:engine.stage(week).key,profileCode:journey.profileCode,source:'screen'});
      alert('코칭 후 기록을 저장했습니다.');
    });

    by('weeklyCompleteWeekV315')?.addEventListener('click',()=>{
      let journey=read();
      const week=selectedWeek(journey);
      journey=engine.savePost(journey,week,postValues());

      if(week<journey.currentWeek||engine.getWeek(journey,week)?.completedAt){
        write(journey);
        track('kgm_week_revised',{week,stage:engine.stage(week).key,status:journey.status,profileCode:journey.profileCode,source:'screen'});
        viewedWeek=null;
        renderScreen();
        return;
      }

      const result=engine.completeWeek(journey,week);
      if(!result.ok){
        alert(result.reason);
        return;
      }
      write(result.journey);
      track('kgm_week_completed',{week,stage:engine.stage(week).key,status:result.journey.status,profileCode:result.journey.profileCode,source:'screen'});
      if(result.journey.status==='completed'){
        track('kgm_seven_week_completed',{week:7,stage:'M',status:'completed',profileCode:result.journey.profileCode,source:'screen'});
      }
      viewedWeek=null;
      renderScreen();
    });

    qsa('.weeklyStepNavV315 button[data-week]').forEach(button=>button.addEventListener('click',()=>{
      const journey=read();
      const week=Number(button.dataset.week);
      if(week<=journey.currentWeek){
        viewedWeek=week;
        renderScreen();
      }
    }));

    by('weeklyPrepareRetestV315')?.addEventListener('click',()=>{
      const journey=read();
      track('kgm_retest_prepared_after_7weeks',{week:7,stage:'M',status:'completed',profileCode:journey?.profileCode||'',source:'screen'});
      closeWeekly();
      setTimeout(()=>{
        const purpose=by('testPurpose');
        const group=by('sampleGroup');
        const key=by('retestKey');
        if(purpose)purpose.value='재검사';
        if(group)group.value='재검사';
        if(key&&!key.value)key.value=journey?.journeyId||'';
        window.scrollTo({top:0,behavior:'smooth'});
      },350);
    });

    by('weeklyRestartV315')?.addEventListener('click',()=>{
      if(!confirm('완료한 7주 기록은 이 기기에서 새 여정으로 교체됩니다. 계속할까요?'))return;
      localStorage.removeItem(engine.STORAGE_KEY);
      viewedWeek=null;
      renderScreen();
    });
  }

  function summaryCard(){
    const journey=read();
    if(!journey){
      return `<div class="weeklyBridgeV315"><div><span>7-WEEK JOURNEY</span><b>결과를 7주간의 코칭대화로 이어갑니다.</b><p>매일 체크하지 않습니다. 주 1회 고객과 대화하며 K-I-N-G-D-O-M 한 단계를 깊게 다룹니다.</p></div><button class="primary weeklyOpenV315">7주 성장여정 시작</button></div>`;
    }
    const progress=engine.progress(journey);
    const stage=engine.stage(journey.currentWeek);
    return `<div class="weeklyBridgeV315 active"><div><span>${journey.status==='completed'?'7-WEEK COMPLETE':`WEEK ${journey.currentWeek} · ${stage.key}`}</span><b>${journey.status==='completed'?'7주 성장통합이 완료되었습니다.':`${journey.currentWeek}주차 · ${esc(stage.title)}`}</b><p>${esc(journey.growthTheme)} · ${progress.completed}/7회 완료</p><i><u style="width:${progress.pct}%"></u></i></div><button class="primary weeklyOpenV315">${journey.status==='completed'?'완료 기록 보기':'이번 주 기록하기'}</button></div>`;
  }

  function patchLegacyTerms(root=document){
    const replacements=[['7일 성장기록','7주 성장여정'],['7일 기록 시작','7주 성장여정 시작'],['7일 기록','7주 성장여정'],['오늘 기록하기','이번 주 기록하기'],['7일 동안','7주 동안'],['7일 완료','7주 성장통합']];
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(node.parentElement?.closest('script,style,noscript,template,textarea,.weeklyLegacyV315'))return;
      let value=node.nodeValue;
      replacements.forEach(([before,after])=>value=value.split(before).join(after));
      if(value!==node.nodeValue)node.nodeValue=value;
    });
  }

  function tagOpenButtons(root,source){
    qsa('.weeklyOpenV315',root).forEach(button=>button.dataset.weeklySource=source);
  }

  function enhanceResult(){
    const result=by('result');
    if(!result||result.classList.contains('hidden'))return;
    patchLegacyTerms(result);
    qsa('.trackerStartPanel',result).forEach(element=>element.style.display='none');
    const old=by('growthTracker');
    if(old){
      old.classList.add('weeklyReplacedV315');
      old.innerHTML=summaryCard();
      const heading=old.previousElementSibling;
      if(heading&&heading.tagName==='H3')heading.textContent='7주 성장여정';
    }
    let bridge=by('weeklyBridgeTopV315');
    const actions=by('actionCards');
    if(actions&&!bridge){
      bridge=document.createElement('div');
      bridge.id='weeklyBridgeTopV315';
      actions.insertAdjacentElement('afterend',bridge);
    }
    if(bridge)bridge.innerHTML=summaryCard();
    qsa('button',result).forEach(button=>{
      if(button.textContent.includes('7주 성장여정')||button.id==='heroTracker13a'||button.dataset.go13b==='growthTracker'){
        button.textContent=read()?'이번 주 기록하기':'7주 성장여정 시작';
        button.classList.add('weeklyOpenV315');
        button.dataset.weeklySource='result';
        button.onclick=null;
      }
    });
    tagOpenButtons(result,'result');
  }

  function enhanceIntro(){
    const intro=by('intro');
    if(!intro)return;
    let panel=by('weeklyEntryV315');
    const anchor=by('resultEntryPanel')||intro.querySelector('.simpleNotice');
    if(!panel){
      panel=document.createElement('div');
      panel.id='weeklyEntryV315';
      if(anchor)anchor.insertAdjacentElement('afterend',panel);
      else intro.prepend(panel);
    }
    panel.innerHTML=read()?summaryCard():'';
    tagOpenButtons(panel,'intro');
  }

  function enhanceJourney(){
    const root=by('journey');
    if(!root||root.classList.contains('hidden'))return;
    patchLegacyTerms(root);
    let panel=by('weeklyJourneySummaryV315');
    if(!panel){
      panel=document.createElement('div');
      panel.id='weeklyJourneySummaryV315';
      const head=root.querySelector('.sectionHead');
      if(head)head.insertAdjacentElement('afterend',panel);
      else root.prepend(panel);
    }
    panel.innerHTML=summaryCard();
    tagOpenButtons(panel,'journey');
  }

  function run(){
    ensureScreen();
    enhanceIntro();
    enhanceResult();
    enhanceJourney();
  }

  const oldShowResult=typeof showResult==='function'?showResult:null;
  if(oldShowResult&&!oldShowResult._weeklyV315){
    showResult=function(sample=false){
      const result=oldShowResult(sample);
      [100,500,1400,3200,7000].forEach(delay=>setTimeout(run,delay));
      return result;
    };
    showResult._weeklyV315=true;
  }

  const oldShowJourney=typeof showJourney==='function'?showJourney:null;
  if(oldShowJourney&&!oldShowJourney._weeklyV315){
    showJourney=function(){
      const result=oldShowJourney();
      [100,500,1400].forEach(delay=>setTimeout(run,delay));
      return result;
    };
    showJourney._weeklyV315=true;
  }

  document.addEventListener('DOMContentLoaded',()=>{
    run();
    [600,1800,4200].forEach(delay=>setTimeout(run,delay));
  });

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.weeklyOpenV315');
    if(!button)return;
    event.preventDefault();
    const source=button.dataset.weeklySource||visibleSource();
    openWeekly(source);
  });

  window.KGM_WEEKLY_JOURNEY_V315={
    ok:true,
    version:VERSION,
    weeks:7,
    cadence:'weekly',
    stages:engine.STAGES.map(stage=>stage.key),
    storageKey:engine.STORAGE_KEY,
    legacyDailyPreserved:true,
    separateViewedWeek:true,
    piiInAnalytics:false,
    open:openWeekly,
    render:renderScreen,
    viewWeek:()=>selectedWeek(read())
  };
})();