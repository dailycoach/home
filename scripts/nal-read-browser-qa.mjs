import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = process.cwd();
const mime = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml",
  ".png":"image/png",
  ".webp":"image/webp",
  ".woff2":"font/woff2"
};
const server = createServer(async (req,res)=>{
  try{
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const decoded = decodeURIComponent(url.pathname);
    const safe = path.resolve(root, "." + decoded);
    if (!safe.startsWith(root + path.sep) && safe !== root) throw new Error("unsafe");
    let file = safe;
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file,"index.html");
    const body = await readFile(file);
    res.writeHead(200,{"content-type":mime[path.extname(file)] || "application/octet-stream"});
    res.end(body);
  } catch {
    res.writeHead(404,{"content-type":"text/plain; charset=utf-8"});
    res.end("Not found");
  }
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const routes = [
  ["/nal/read/","책을 읽고"],
  ["/nal/read/trend-2027/","TREND"],
  ["/nal/read/trend-2027/welcome/","앞으로 28일"],
  ["/nal/read/trend-2027/before/","지금의 나를"],
  ["/nal/read/auth/callback/","로그인을"]
];
const viewports = [
  {width:320,height:800},
  {width:390,height:844},
  {width:768,height:1024},
  {width:1024,height:900},
  {width:1440,height:1000}
];

const browser = await chromium.launch({headless:true});
const failures=[];
try{
  for(const viewport of viewports){
    const context = await browser.newContext({viewport});
    for(const [route,expected] of routes){
      const page = await context.newPage();
      const issues=[];
      page.on("pageerror",e=>issues.push("pageerror:"+e.message));
      page.on("console",m=>{
        if(m.type()==="error" && !/NAL READ 인증 설정/.test(m.text())) issues.push("console:"+m.text());
      });
      await page.route("https://cdn.jsdelivr.net/**", r=>r.fulfill({status:200,contentType:"application/javascript",body:""}));
      const response = await page.goto(base+route,{waitUntil:"networkidle"});
      const metrics = await page.evaluate(()=>({
        scrollWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth,
        bodyFont:Number.parseFloat(getComputedStyle(document.body).fontSize),
        mainCount:document.querySelectorAll("main#main-content[data-page-root]").length,
        h1:document.querySelector("h1")?.textContent?.trim() || "",
        skip:document.querySelector('.nal-skip-link')?.getAttribute('href') || ""
      }));
      if(response?.status()!==200) failures.push(`${route} ${viewport.width}: status ${response?.status()}`);
      if(!metrics.h1.includes(expected)) failures.push(`${route} ${viewport.width}: expected text missing`);
      if(metrics.scrollWidth>metrics.clientWidth) failures.push(`${route} ${viewport.width}: horizontal overflow ${metrics.scrollWidth}/${metrics.clientWidth}`);
      if(metrics.bodyFont<16) failures.push(`${route} ${viewport.width}: body font ${metrics.bodyFont}`);
      if(metrics.mainCount!==1) failures.push(`${route} ${viewport.width}: main landmark ${metrics.mainCount}`);
      if(metrics.skip!=="#main-content") failures.push(`${route} ${viewport.width}: skip link missing`);
      if(issues.length) failures.push(`${route} ${viewport.width}: ${issues.join("; ")}`);
      await page.close();
    }
    await context.close();
  }

  const context = await browser.newContext({viewport:{width:390,height:844}});
  const page = await context.newPage();
  await page.route("https://cdn.jsdelivr.net/**", r=>r.fulfill({status:200,contentType:"application/javascript",body:""}));
  await page.goto(base+"/nal/read/trend-2027/",{waitUntil:"networkidle"});
  await page.evaluate(()=>{document.documentElement.style.fontSize="200%";});
  const zoomMetrics = await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
    h1:document.querySelector("h1")?.textContent?.trim() || ""
  }));
  if(zoomMetrics.scrollWidth>zoomMetrics.clientWidth) failures.push("200% text: horizontal overflow");
  if(!zoomMetrics.h1.includes("TREND")) failures.push("200% text: content missing");
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

if(failures.length){
  console.error(`NAL READ browser QA failed (${failures.length})`);
  for(const failure of failures) console.error("- "+failure);
  process.exit(1);
}
console.log(`NAL READ browser QA passed: ${routes.length} routes x ${viewports.length} viewports + 200% text`);
