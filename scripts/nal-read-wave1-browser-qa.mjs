import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const require=createRequire(import.meta.url);
const { chromium }=require("playwright");
const root=process.cwd();
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".webp":"image/webp",".woff2":"font/woff2"};
const server=createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||"/","http://127.0.0.1");
    const safe=path.resolve(root,"."+decodeURIComponent(u.pathname));
    if(!safe.startsWith(root+path.sep)&&safe!==root)throw new Error("unsafe");
    let file=safe;const info=await stat(file);if(info.isDirectory())file=path.join(file,"index.html");
    const body=await readFile(file);res.writeHead(200,{"content-type":mime[path.extname(file)]||"application/octet-stream"});res.end(body);
  }catch{res.writeHead(404);res.end("Not found")}
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const base=`http://127.0.0.1:${server.address().port}`;
const fakeUrl="https://abcdefghijklmnopqrst.supabase.co";
const fakeKey="sb_publishable_FAKE_NAL_READ_W1";
const calls=[];

const bootstrap={
  seasonSlug:"trend-2027",seasonTitle:"TREND 2027",enrollmentId:"11111111-1111-4111-8111-111111111111",enrollmentStatus:"active",currentDay:1,
  journey:[
    {dayNumber:0,title:"BEFORE",dayType:"before",estimatedMinutes:3,progress:"completed",unlocked:true},
    {dayNumber:1,title:"재미가 없어진 이유",dayType:"daily",estimatedMinutes:4,progress:"started",unlocked:true},
    {dayNumber:2,title:"나는 왜 이렇게 바쁠까",dayType:"daily",estimatedMinutes:4,progress:"locked",unlocked:false}
  ]
};
function dayPayload(n){
  if(n===0)return {dayNumber:0,title:"BEFORE",dayType:"before",estimatedMinutes:3,steps:[
    {order:1,type:"SCALE",prompt:"나는 요즘 삶에 만족한다.",required:true,answerJson:null},
    {order:2,type:"QUESTION",prompt:"28일 뒤 무엇이 달라져 있으면 좋겠나요?",placeholder:"한 문장이어도 충분합니다.",required:true,answerText:null}
  ]};
  return {dayNumber:1,title:"재미가 없어진 이유",dayType:"daily",estimatedMinutes:4,steps:[
    {order:1,type:"HOOK",content:"열심히 사는데\n왜 재미가 없을까요?",required:false},
    {order:2,type:"QUESTION",prompt:"최근 한 달 동안 가장 살아있다고 느낀 순간은 언제였나요?",placeholder:"한 문장이어도 충분합니다.",required:true,answerText:null}
  ]};
}
const supabaseStub=`
window.supabase={createClient(){
  const session={access_token:"fake-token",user:{id:"11111111-1111-4111-8111-111111111111",email:"qa@example.invalid"}};
  return {auth:{
    async getSession(){return {data:{session},error:null}},
    onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}},
    async signInWithOtp(){return {error:null}},
    async signOut(){return {error:null}}
  }};
}};
`;

const browser=await chromium.launch({headless:true});
const failures=[];
async function context(width=390,height=844){
  const ctx=await browser.newContext({viewport:{width,height}});
  await ctx.route("https://cdn.jsdelivr.net/**",r=>r.fulfill({status:200,contentType:"application/javascript",body:supabaseStub}));
  await ctx.route("**/nal/data/read-backend.staging.json",r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({enabled:true,url:fakeUrl,publishableKey:fakeKey})}));
  await ctx.route(fakeUrl+"/functions/v1/nal-read-daily",async r=>{
    const body=JSON.parse(r.request().postData()||"{}");calls.push(body);
    let payload={};
    if(body.action==="bootstrap")payload=bootstrap;
    else if(body.action==="day")payload=dayPayload(Number(body.dayNumber));
    else if(body.action==="save-answer")payload={saved:true,answerId:"22222222-2222-4222-8222-222222222222"};
    else if(body.action==="complete-day")payload={completed:true,dayNumber:Number(body.dayNumber)};
    else return r.fulfill({status:400,contentType:"application/json",body:JSON.stringify({error:"Unknown action"})});
    return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(payload)});
  });
  return ctx;
}
function check(cond,msg){if(!cond)failures.push(msg)}

try{
  {
    const ctx=await context();const page=await ctx.newPage();
    await page.goto(base+"/nal/read/trend-2027/today/",{waitUntil:"networkidle"});
    check((await page.locator("[data-today-title]").textContent())?.includes("재미가 없어진 이유"),"TODAY title");
    check((await page.locator("[data-today-open]").getAttribute("href"))?.includes("day/?day=1"),"TODAY link");
    const m=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
    check(m.sw<=m.cw,"TODAY overflow");
    await ctx.close();
  }
  {
    const ctx=await context();const page=await ctx.newPage();
    await page.goto(base+"/nal/read/trend-2027/journey/",{waitUntil:"networkidle"});
    const text=await page.locator("[data-journey-list]").textContent();
    check(text.includes("BEFORE")&&text.includes("재미가 없어진 이유")&&text.includes("잠김"),"JOURNEY content");
    await ctx.close();
  }
  {
    const ctx=await context();const page=await ctx.newPage();
    await page.goto(base+"/nal/read/trend-2027/before/",{waitUntil:"networkidle"});
    await page.locator('input[name="scale"][value="4"]').check();
    await page.getByRole("button",{name:"기록하고 계속"}).click();
    await page.locator("textarea").fill("방향이 더 선명해졌으면 좋겠다");
    await page.getByRole("button",{name:"기록하고 계속"}).click();
    await page.getByRole("button",{name:"오늘 기록 마치기"}).click();
    await page.waitForTimeout(50);
    check((await page.locator(".read-question").textContent())?.includes("오늘의 기록이 남았습니다"),"BEFORE complete");
    await ctx.close();
  }
  {
    const ctx=await context();const page=await ctx.newPage();
    await page.goto(base+"/nal/read/trend-2027/day/?day=1",{waitUntil:"networkidle"});
    check((await page.locator(".read-question").textContent())?.includes("열심히 사는데"),"DAY hook");
    await page.getByRole("button",{name:"계속"}).click();
    await page.locator("textarea").fill("오래 대화했을 때");
    await page.getByRole("button",{name:"기록하고 계속"}).click();
    await page.getByRole("button",{name:"오늘 기록 마치기"}).click();
    await page.waitForFunction(() => document.querySelector(".read-question")?.textContent?.includes("오늘의 기록이 남았습니다"));
    check((await page.locator(".read-question").textContent())?.includes("오늘의 기록이 남았습니다"),"DAY complete");
    await ctx.close();
  }
  {
    const ctx=await context(390,844);const page=await ctx.newPage();
    await page.goto(base+"/nal/read/trend-2027/day/?day=1",{waitUntil:"networkidle"});
    await page.evaluate(()=>{document.documentElement.style.fontSize="200%"});
    const m=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
    check(m.sw<=m.cw,"W1 200% text overflow");
    await ctx.close();
  }
  check(calls.some(x=>x.action==="bootstrap"),"bootstrap API not called");
  check(calls.filter(x=>x.action==="save-answer").length>=3,"answer API calls missing");
  check(calls.filter(x=>x.action==="complete-day").length>=2,"complete API calls missing");
}finally{
  await browser.close();
  await new Promise(r=>server.close(r));
}
if(failures.length){console.error(`NAL READ W1 browser QA failed (${failures.length})`);for(const f of failures)console.error("- "+f);process.exit(1)}
console.log(`NAL READ W1 browser QA passed; API calls=${calls.length}`);
