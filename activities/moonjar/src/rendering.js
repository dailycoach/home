import {drawScene, backgroundKey} from './domain.js';
const NS = 'http://www.w3.org/2000/svg';
const element = (name, attrs) => { const el = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); return el; };
export const assetURL = path => globalThis.__MOONJAR_BUNDLE__?.assets[path] || path;
export class Materials {
  constructor(manifest) { this.manifest = manifest; this.cache = new Map(); }
  asset(id) { return this.manifest.pieces.find(a => a.id === id); }
  path(id) {
    if(id==='porcelain-light')return assetURL('assets/moonjar-v2/porcelain-day.png');
    if(id==='porcelain-dark')return assetURL('assets/moonjar-v2/porcelain-night.png');
    if(id==='canvas-light'||id==='canvas-dark')return assetURL(`assets/canvas_${id.slice(7)}.png`);
    return assetURL(this.asset(id)?.src);
  }
  load(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const promise = new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img);
      img.onerror = () => { this.cache.delete(id); reject(new Error(`${id} 이미지를 불러오지 못했어요. 재료를 다시 누르거나 이미지 저장을 재시도해 주세요.`)); };
      img.src = this.path(id);
    });
    this.cache.set(id, promise); return promise;
  }
  async forScene(scene) {
    const ids = [...new Set([backgroundKey(scene), ...scene.nodes.map(n => n.assetId)])];
    return new Map(await Promise.all(ids.map(async id => [id, await this.load(id)])));
  }
}
export function renderSVG(svg, scene, materials, selectedId = null, previewNode = null) {
  if(previewNode){
    const group=[...svg.querySelectorAll('[data-node]')].find(g=>g.dataset.node===previewNode.instanceId);
    if(group){
      group.setAttribute('transform',`translate(${previewNode.x} ${previewNode.y}) rotate(${previewNode.rotation})`);
      const img=group.querySelector('image');for(const [key,value]of Object.entries({x:-previewNode.width/2,y:-previewNode.height/2,width:previewNode.width,height:previewNode.height}))img.setAttribute(key,value);
    }
    svg.querySelector('.selection')?.remove();
  }else{
    svg.replaceChildren();
    svg.append(element('image', {href: materials.path(backgroundKey(scene)), x: 0, y: 0, width: 1600, height: 1800, 'pointer-events': 'none'}));
    for (const n of scene.nodes) {
      const g = element('g', {transform: `translate(${n.x} ${n.y}) rotate(${n.rotation})`, 'data-node': n.instanceId});
      g.append(element('image', {href: materials.path(n.assetId), x: -n.width / 2, y: -n.height / 2, width: n.width, height: n.height, 'data-id': n.instanceId}));
      svg.append(g);
    }
    svg.querySelectorAll('image').forEach(image => image.addEventListener('error',()=>{
    const message = document.querySelector('#notice');
      if(message){
        message.textContent='작품 재료를 읽지 못했어요. ';const retry=document.createElement('button');retry.type='button';retry.textContent='다시 불러오기';
        retry.onclick=()=>{const src=image.getAttribute('href');image.removeAttribute('href');image.setAttribute('href',src);message.classList.remove('visible');message.style.pointerEvents='';};
        message.append(retry);message.classList.add('visible');message.style.pointerEvents='auto';
      }
    },{once:true}));
  }
  const n = previewNode || scene.nodes.find(n => n.instanceId === selectedId);
  if (n && selectedId) {
    const g = element('g', {transform: `translate(${n.x} ${n.y}) rotate(${n.rotation})`, class: 'selection'});
    const w = Math.max(n.width, 96), h = Math.max(n.height, 96);
    g.append(element('rect', {x: -w / 2 - 12, y: -h / 2 - 12, width: w + 24, height: h + 24, fill: 'none', stroke: '#49685D', 'stroke-width': 5, 'stroke-dasharray': n.locked ? '16 10' : 'none', 'pointer-events':'none'}));
    if (!n.locked) {
      g.append(element('line', {x1: 0, y1: -h / 2 - 12, x2: 0, y2: -h / 2 - 95, stroke: '#49685D', 'stroke-width': 5, 'pointer-events':'none'}));
      for (const [mode, x, y] of [['rotate',0,-h / 2 - 95],['resize',w / 2 + 12,h / 2 + 12]]) {
        g.append(element('circle', {cx: x, cy: y, r: 42, fill: '#FFFEFA', stroke: '#49685D', 'stroke-width': 5, 'data-id': n.instanceId, 'data-handle': mode}));
        const label = element('text', {x, y: y + 14, 'text-anchor':'middle', 'font-size':48, fill:'#253536', 'pointer-events':'none'}); label.textContent = mode === 'rotate' ? '↻' : '↗'; g.append(label);
      }
    }
    svg.append(g);
  }
}
export async function exportPNG(scene, materials, scale = 1) {
  const images = await materials.forScene(scene);
  const canvas = document.createElement('canvas'); canvas.width = 1600 * scale; canvas.height = 1800 * scale;
  try {
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('이미지 작업 공간을 만들지 못했어요.');
    ctx.scale(scale, scale); drawScene(ctx, scene, images);
    return await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG 파일을 만들지 못했어요.')), 'image/png'));
  } finally { canvas.width = 0; canvas.height = 0; images.clear(); }
}
// Deliberately explicit copy: never read reflections from project data here.
// The caller must pass precisely the text the user opted into publishing.
export function normalizeCardCopy(copy = {}) {
  const title = String(copy.title ?? '').trim();
  const sentence = String(copy.sentence ?? '').trim();
  if ([...title].length > 50 || [...sentence].length > 100)
    throw new Error('작품 카드 문구가 너무 길어요. 제목 50자, 한 문장 100자까지 담을 수 있어요.');
  return {title, sentence};
}

// Card typography never truncates or hides a participant's chosen words.
// If a phrase cannot fit legibly, the participant edits only the optional
// card copy; the private original reflection remains untouched.
function wrapCardLines(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).replaceAll('\r','').split('\n')) {
    let row = '';
    for (const char of paragraph) {
      const next = row + char;
      if (row && ctx.measureText(next).width > maxWidth) {
        lines.push(row); row = char;
      } else row = next;
    }
    lines.push(row);
  }
  return lines;
}

export function planCardText(ctx, input, {
  maxWidth=1320, maxLines=2, preferred=98, minimum=68, step=2,
  family='"Batang", "AppleMyungjo", "Noto Serif KR", serif'
}={}) {
  const text = String(input ?? '').trim();
  if (!text) return {size:preferred, lines:[]};
  for (let size=preferred; size>=minimum; size-=step) {
    ctx.font = `500 ${size}px ${family}`;
    const lines=wrapCardLines(ctx,text,maxWidth);
    if(lines.length <= maxLines && lines.every(line=>ctx.measureText(line).width<=maxWidth))
      return {size,lines};
  }
  throw new Error('작품 카드에 글을 모두 담기 어려워요. 원본 기록은 그대로 두고 카드용 문구만 조금 짧게 다듬어 주세요.');
}

export async function exportCardPNG(scene, materials, copy = {}, scale = 1) {
  if (![0.4, 0.5, 1].includes(scale)) throw new Error('지원하지 않는 작품 카드 크기입니다.');
  const {title, sentence} = normalizeCardCopy(copy);
  const images = await materials.forScene(scene);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(1600 * scale);
  canvas.height = Math.round(2400 * scale);
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('작품 카드 이미지 작업 공간을 만들지 못했어요.');
    ctx.scale(scale, scale);

    const serif = '"Batang", "AppleMyungjo", "Noto Serif KR", serif';
    const sans = 'system-ui, "Malgun Gothic", sans-serif';
    const titleStyle=planCardText(ctx,title || '나를 담고, 다시 보다',{
      maxWidth:1320,maxLines:2,preferred:110,minimum:76,step:2,family:serif
    });
    const sentenceStyle=planCardText(ctx,sentence,{
      maxWidth:1300,maxLines:3,preferred:76,minimum:52,step:2,family:sans
    });

    // Warm paper, protected artwork area and a quiet editorial hierarchy.
    ctx.fillStyle = '#F5F3ED';
    ctx.fillRect(0,0,1600,2400);
    ctx.fillStyle = '#FFFEFA';
    ctx.fillRect(64,62,1472,2280);
    ctx.strokeStyle = '#CED4CB';
    ctx.lineWidth=2;
    ctx.strokeRect(64,62,1472,2280);

    ctx.fillStyle='#536F61';
    ctx.font=`600 35px ${sans}`;
    ctx.textAlign='left';
    ctx.fillText('DAILYCOACHING   /   MOONJAR',120,145);
    ctx.textAlign='right';
    ctx.fillStyle='#627A6F';
    ctx.font=`33px ${serif}`;
    ctx.fillText('빛을 담는 달항아리',1480,145);
    ctx.strokeStyle='#D2D9CF';
    ctx.beginPath();ctx.moveTo(118,186);ctx.lineTo(1482,186);ctx.stroke();

    // The work itself is displayed in full without cropping, including
    // nacre intentionally placed outside the outline.
    const artScale=sentence ? .78 : .85;
    const artX=(1600-1600*artScale)/2;
    const artY=222;
    ctx.fillStyle=scene.theme==='dark'?'#12232A':'#FFFFFF';
    ctx.fillRect(artX-8,artY-8,1600*artScale+16,1800*artScale+16);
    ctx.save();
    ctx.translate(artX,artY);
    ctx.scale(artScale,artScale);
    drawScene(ctx,scene,images);
    ctx.restore();
    ctx.strokeStyle='#C7CEC4';
    ctx.strokeRect(artX-8,artY-8,1600*artScale+16,1800*artScale+16);

    const headingY=sentence?1792:1877;
    ctx.textAlign='left';
    ctx.fillStyle='#2B3D37';
    ctx.font=`500 ${titleStyle.size}px ${serif}`;
    const headingLeading=116;
    titleStyle.lines.forEach((line,i)=>ctx.fillText(line,126,headingY+i*headingLeading));

    if(sentenceStyle.lines.length){
      ctx.fillStyle='#536C61';
      ctx.font=`450 ${sentenceStyle.size}px ${sans}`;
      const firstSentenceY=headingY+titleStyle.lines.length*headingLeading+34;
      sentenceStyle.lines.forEach((line,i)=>ctx.fillText(line,126,firstSentenceY+i*70));
    }

    ctx.strokeStyle='#CFD6CD';
    ctx.beginPath();ctx.moveTo(120,2260);ctx.lineTo(1480,2260);ctx.stroke();
    ctx.textAlign='left';
    ctx.fillStyle='#657970';
    ctx.font=`31px ${sans}`;
    ctx.fillText('나를 담고, 다시 보다',120,2320);
    ctx.textAlign='right';
    ctx.fillText('빛을 담는 달항아리',1480,2320);

    return await new Promise((resolve, reject) => canvas.toBlob(blob =>
      blob ? resolve(blob) : reject(new Error('작품 카드 PNG를 만들지 못했어요.')), 'image/png'));
  } finally {
    canvas.width=0;
    canvas.height=0;
    images.clear();
  }
}
export function download(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
