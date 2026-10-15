import {drawScene} from './domain.js';
const NS = 'http://www.w3.org/2000/svg';
const element = (name, attrs) => { const el = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); return el; };
export const assetURL = path => globalThis.__MOONJAR_BUNDLE__?.assets[path] || path;
export class Materials {
  constructor(manifest) { this.manifest = manifest; this.cache = new Map(); }
  asset(id) { return this.manifest.pieces.find(a => a.id === id); }
  path(id) { return assetURL(id.startsWith('canvas-') ? `assets/canvas_${id.slice(7)}.png` : this.asset(id)?.src); }
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
    const ids = [...new Set([`canvas-${scene.theme}`, ...scene.nodes.map(n => n.assetId)])];
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
    svg.append(element('image', {href: materials.path(`canvas-${scene.theme}`), x: 0, y: 0, width: 1600, height: 1800, 'pointer-events': 'none'}));
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
export function download(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
