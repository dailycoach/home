(() => {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s);
  const page=document.body.dataset.readDailyPage||"";
  const seasonSlug=document.body.dataset.season||"trend-2027";
  let config=null,client=null,session=null,dayData=null,stepIndex=0;

  async function json(url,options={}){
    const res=await fetch(url,{cache:"no-store",...options});
    const value=await res.json().catch(()=>({}));
    if(!res.ok){const e=new Error(value.error||("HTTP "+res.status));e.status=res.status;throw e}
    return value;
  }
  function backendConfigPath(){
    const host=location.hostname.toLowerCase();
    const production=host==="daily-coach-ing.com"||host==="www.daily-coach-ing.com";
    return production?"/nal/data/backend.json":"/nal/data/read-backend.staging.json";
  }
  function setStatus(message,state=""){
    const el=$("[data-daily-status]");
    if(!el)return;
    el.hidden=!message;el.textContent=message||"";el.dataset.state=state;
  }
  async function setup(){
    config=await json(backendConfigPath());
    if(config?.enabled!==true||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url||"")||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey||"")){
      throw new Error("NAL READ 비운영 연결이 아직 열리지 않았습니다.");
    }
    if(!globalThis.supabase?.createClient)throw new Error("인증 모듈을 불러오지 못했습니다.");
    client=globalThis.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const current=await client.auth.getSession();
    session=current.data?.session||null;
    client.auth.onAuthStateChange((_e,next)=>{session=next;renderAuth();if(next)void renderPage()});
  }
  function renderAuth(){
    const auth=$("[data-daily-auth]"),account=$("[data-daily-account]");
    if(auth)auth.hidden=Boolean(session);
    if(account)account.hidden=!session;
    const email=$("[data-daily-email]");if(email)email.textContent=session?.user?.email||"";
  }
  async function sendMagicLink(event){
    event.preventDefault();
    const email=$("[data-daily-login-email]")?.value.trim();
    if(!email)return setStatus("이메일을 입력해 주세요.","error");
    const callback=new URL("/nal/read/auth/callback/",location.origin);
    callback.searchParams.set("next",location.pathname+location.search);
    const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:callback.href,shouldCreateUser:true}});
    if(error)return setStatus(error.message||"로그인 링크를 보내지 못했습니다.","error");
    setStatus("이메일로 로그인 링크를 보냈습니다.","ok");
  }
  async function signOut(){await client.auth.signOut();location.href="/nal/read/";}
  async function api(action,payload={}){
    if(!session?.access_token)throw new Error("로그인이 필요합니다.");
    return json(config.url+"/functions/v1/nal-read-daily",{
      method:"POST",
      headers:{apikey:config.publishableKey,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
      body:JSON.stringify({action,seasonSlug,...payload})
    });
  }
  function escapeText(value){return String(value??"");}
  function inputStep(step){
    return ["QUESTION","MULTI_SELECT","SCALE","TRY","RECORD"].includes(step.type);
  }
  function getDayNumber(){
    if(page==="before")return 0;
    const n=Number(new URLSearchParams(location.search).get("day"));
    return Number.isInteger(n)&&n>=0&&n<=366?n:null;
  }
  function dayHref(day){return day===0?"/nal/read/trend-2027/before/":"/nal/read/trend-2027/day/?day="+day;}

  async function renderToday(){
    const data=await api("bootstrap");
    const current=Number(data.currentDay);
    const item=(data.journey||[]).find(x=>Number(x.dayNumber)===current)||(data.journey||[]).at(-1);
    const title=$("[data-today-title]"),meta=$("[data-today-meta]"),link=$("[data-today-open]");
    if(title)title.textContent=item?.title||"오늘의 질문";
    if(meta)meta.textContent=item?`DAY ${String(item.dayNumber).padStart(2,"0")} · ${item.estimatedMinutes} MIN`:"";
    if(link){link.href=dayHref(current);link.hidden=!item}
    setStatus("오늘 이어갈 자리를 찾았습니다.","ok");
  }
  async function renderJourney(){
    const data=await api("bootstrap");
    const list=$("[data-journey-list]");if(!list)return;
    list.replaceChildren();
    for(const item of data.journey||[]){
      const li=document.createElement("li");
      const num=document.createElement("span");num.className="read-meta";num.textContent=item.dayNumber===0?"BEFORE":String(item.dayNumber).padStart(2,"0");
      const body=document.createElement("span");body.textContent=item.title;
      const state=document.createElement("span");state.className="read-lock";
      if(item.progress==="completed")state.textContent="완료";
      else if(item.unlocked){const a=document.createElement("a");a.href=dayHref(Number(item.dayNumber));a.textContent="열기 →";state.append(a)}
      else state.textContent="잠김";
      li.append(num,body,state);list.append(li);
    }
    setStatus("내 여정을 불러왔습니다.","ok");
  }
  function renderStep(){
    const root=$("[data-step-root]");if(!root||!dayData)return;
    const step=dayData.steps?.[stepIndex];
    if(!step){renderDone(false);return}
    root.replaceChildren();
    const wrap=document.createElement("section");wrap.className="read-step";
    const meta=document.createElement("p");meta.className="read-eyebrow";meta.textContent=`STEP ${stepIndex+1} / ${dayData.steps.length} · ${step.type}`;
    wrap.append(meta);
    if(step.content){
      const node=document.createElement(step.type==="HOOK"?"h1":"p");
      node.className=step.type==="HOOK"?"read-question":"read-step-copy";
      node.textContent=escapeText(step.content);wrap.append(node);
    }
    if(step.prompt){
      const h=document.createElement("h2");h.className="read-step-prompt";h.textContent=escapeText(step.prompt);wrap.append(h);
    }
    let control=null;
    if(step.type==="QUESTION"||step.type==="TRY"||step.type==="RECORD"){
      control=document.createElement("textarea");control.className="read-answer";control.rows=5;control.placeholder=step.placeholder||"한 문장이어도 충분합니다.";control.value=step.answerText||"";wrap.append(control);
    }else if(step.type==="SCALE"){
      control=document.createElement("div");control.className="read-scale";
      for(let i=1;i<=5;i++){const label=document.createElement("label");const input=document.createElement("input");input.type="radio";input.name="scale";input.value=String(i);if(Number(step.answerJson?.value)===i)input.checked=true;label.append(input,document.createTextNode(String(i)));control.append(label)}wrap.append(control);
    }else if(step.type==="MULTI_SELECT"){
      control=document.createElement("div");control.className="read-options";
      const selected=new Set(Array.isArray(step.answerJson?.values)?step.answerJson.values:[]);
      for(const option of step.options||[]){const label=document.createElement("label");const input=document.createElement("input");input.type="checkbox";input.value=String(option);input.checked=selected.has(option);label.append(input,document.createTextNode(String(option)));control.append(label)}wrap.append(control);
    }
    const actions=document.createElement("div");actions.className="read-actions";
    const next=document.createElement("button");next.className="read-button";next.type="button";next.textContent=inputStep(step)?"기록하고 계속":"계속";
    next.addEventListener("click",async()=>{
      next.disabled=true;
      try{
        if(inputStep(step)){
          let answerText=null,answerJson=null;
          if(step.type==="QUESTION"||step.type==="TRY"||step.type==="RECORD"){
            answerText=control.value.trim();
            if(step.required&&!answerText)throw new Error("한 문장을 남겨주세요.");
          }else if(step.type==="SCALE"){
            const picked=control.querySelector('input:checked');
            if(step.required&&!picked)throw new Error("지금의 값을 골라주세요.");
            answerJson=picked?{value:Number(picked.value)}:null;
          }else if(step.type==="MULTI_SELECT"){
            const values=[...control.querySelectorAll('input:checked')].map(x=>x.value);
            if(step.required&&!values.length)throw new Error("하나 이상 골라주세요.");
            answerJson={values};
          }
          await api("save-answer",{dayNumber:dayData.dayNumber,stepOrder:step.order,answerText,answerJson});
        }
        stepIndex++;renderStep();setStatus("");
      }catch(e){setStatus(e.message||"기록하지 못했습니다.","error");next.disabled=false}
    });
    actions.append(next);wrap.append(actions);root.append(wrap);
  }
  async function renderDone(already){
    const root=$("[data-step-root]");if(!root||!dayData)return;
    root.replaceChildren();
    const wrap=document.createElement("section");wrap.className="read-step";
    const meta=document.createElement("p");meta.className="read-eyebrow";meta.textContent=dayData.dayNumber===0?"BEFORE":"DAY "+String(dayData.dayNumber).padStart(2,"0");
    const h=document.createElement("h1");h.className="read-question";h.textContent=already?"오늘의 기록이 남았습니다.":"오늘은 여기까지.";
    const p=document.createElement("p");p.className="read-step-copy";p.textContent="내가 남긴 문장은 그대로 저장됩니다.";
    const actions=document.createElement("div");actions.className="read-actions";
    const complete=document.createElement("button");complete.className="read-button";complete.type="button";complete.textContent="오늘 기록 마치기";
    complete.addEventListener("click",async()=>{complete.disabled=true;try{await api("complete-day",{dayNumber:dayData.dayNumber});h.textContent="오늘의 기록이 남았습니다.";complete.remove();const a=document.createElement("a");a.className="read-button secondary";a.href="/nal/read/trend-2027/today/";a.textContent="TODAY로 돌아가기";actions.append(a);setStatus("완료했습니다.","ok")}catch(e){setStatus(e.message||"완료하지 못했습니다.","error");complete.disabled=false}});
    actions.append(complete);wrap.append(meta,h,p,actions);root.append(wrap);
  }
  async function renderDay(){
    const n=getDayNumber();
    if(n===null)throw new Error("DAY 주소가 올바르지 않습니다.");
    dayData=await api("day",{dayNumber:n});
    stepIndex=0;
    const meta=$("[data-day-meta]");if(meta)meta.textContent=n===0?"BEFORE":`DAY ${String(n).padStart(2,"0")} · ${dayData.estimatedMinutes} MIN`;
    renderStep();setStatus("");
  }
  async function renderPage(){
    if(!session)return setStatus("로그인하면 내 기록을 이어갈 수 있습니다.");
    try{
      if(page==="today")await renderToday();
      else if(page==="journey")await renderJourney();
      else if(page==="before"||page==="day")await renderDay();
    }catch(e){
      if(e.status===503)setStatus("NAL READ 개발 연결은 아직 비활성 상태입니다.");
      else if(e.status===403)setStatus("아직 열리지 않은 DAY이거나 이용권이 없습니다.","error");
      else setStatus(e.message||"NAL READ를 불러오지 못했습니다.","error");
    }
  }
  async function boot(){
    try{
      await setup();renderAuth();
      $("[data-daily-auth-form]")?.addEventListener("submit",sendMagicLink);
      $("[data-daily-signout]")?.addEventListener("click",signOut);
      await renderPage();
    }catch(e){setStatus(e.message||"NAL READ를 준비하지 못했습니다.","error")}
  }
  void boot();
})();