/**
 * WAVE 9.7 — A-only craft art study, not a deployed art engine.
 *
 * One Canvas painter is the SINGLE source for a read-only A study preview,
 * a participant-chosen PNG download, and the artwork placed inside the card.
 * The native editor's SVG, legacy PNG/card exports, saved scene schema,
 * 96 transparent source images, and position/size values are untouched.
 *
 * IMPORTANT: This is a restrained original-material approximation; it is
 * NOT bit-identical to the separate Python W9.5 painter and is not PBR.
 * All study backgrounds are generated into a QA artifact, not committed to
 * production and never registered as a canvasVariant.
 */
import {normalizeCardCopy} from './rendering.js';

const W=1600,H=1800;
const BG={
  light:new URL('../assets/moonjar-a-study/porcelain-day.png',import.meta.url).href,
  dark:new URL('../assets/moonjar-a-study/porcelain-night.png',import.meta.url).href,
};
const imageCache=new Map();

function loadImage(url){
  if(!imageCache.has(url)){
    const promised=new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error('A형 시안의 백자 이미지를 불러오지 못했습니다. 연구용 패키지를 확인해 주세요.'));
      img.src=url;
    });
    imageCache.set(url,promised);
  }
  return imageCache.get(url);
}
function vesselCenter(node){
  // Limited diffusion effect is restricted to the central vessel,
  // not to free placement outside its contour. The original shape is still
  // a user-controlled 1600 × 1800 coordinate plane.
  const {x,y}=node;
  if(y<355||y>1505)return false;
  const vertical=Math.abs((y-945)/650);
  const radius=560*Math.sqrt(Math.max(0,1-vertical*vertical));
  return Math.abs(x-800)<radius*.83;
}
function drawStudyScene(ctx,scene,pieces,background){
  if(!ctx)throw new Error('작품 이미지 작업 공간을 준비할 수 없습니다.');
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(background,0,0,W,H);
  for(const n of scene.nodes){
    const img=pieces.get(n.assetId);
    if(!img)throw new Error('기존 자개 조각을 읽지 못했습니다: '+n.assetId);
    ctx.save();
    ctx.translate(n.x,n.y);
    ctx.rotate(n.rotation*Math.PI/180);
    if(vesselCenter(n)){
      // A study-only, opt-in illusion of contact. In no case recolor a PNG
      // on disk, alter its alpha, clamp an off-jar piece, or persist a style.
      ctx.shadowColor='rgba(38,47,40,0.13)';
      ctx.shadowBlur=4.5;
      ctx.shadowOffsetX=1.3;
      ctx.shadowOffsetY=2.4;
      ctx.filter='brightness(1.012) saturate(0.992)';
    }
    ctx.drawImage(img,-n.width/2,-n.height/2,n.width,n.height);
    ctx.restore();
  }
}
function asPNG(canvas){
  return new Promise((resolve,reject)=>canvas.toBlob(
    b=>b?resolve(b):reject(new Error('이미지 PNG 생성에 실패했습니다.')),
    'image/png'
  ));
}
export function craftStudyEnabled(){
  return new URLSearchParams(location.search).get('artStudy')==='craft-a';
}
export async function createCraftAArtwork(scene,materials){
  const theme=scene.theme==='dark'?'dark':'light';
  const [background,pieces]=await Promise.all([
    loadImage(BG[theme]),
    materials.forScene(scene)
  ]);
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  try{
    drawStudyScene(canvas.getContext('2d'),scene,pieces,background);
    return await asPNG(canvas);
  }finally{
    canvas.width=0;canvas.height=0;
    pieces.clear();
  }
}

function planText(ctx,text,{maxWidth=1310,maxLines=2,preferred=84,minimum=44,label='문구'}={}){
  const content=String(text||'').replaceAll('\r','').trim();
  if(!content)return {size:preferred,lines:[]};
  const family='"Moonjar Gowun","Batang","Noto Serif KR",serif';
  for(let size=preferred;size>=minimum;size-=2){
    ctx.font='500 '+size+'px '+family;
    const lines=[];
    for(const paragraph of content.split('\n')){
      let current='';
      for(const char of paragraph){
        const next=current+char;
        if(current&&ctx.measureText(next).width>maxWidth){
          lines.push(current);current=char;
        }else current=next;
      }
      lines.push(current);
    }
    if(lines.length<=maxLines && lines.every(line=>ctx.measureText(line).width<=maxWidth)){
      return {size,lines};
    }
  }
  throw new Error(label+'를 생략하지 않고 담을 공간이 부족합니다. 카드용 문구를 조금 줄여주세요.');
}
export async function createCraftACard(artworkPNG,copy={}){
  const normalized=normalizeCardCopy(copy);
  const artwork=await createImageBitmap(artworkPNG);
  const canvas=document.createElement('canvas');
  canvas.width=1600;canvas.height=2400;
  try{
    if(artwork.width!==W||artwork.height!==H)throw new Error('원본 작품 이미지가 1600×1800이 아닙니다.');
    await document.fonts.ready;
    const ctx=canvas.getContext('2d',{alpha:false});
    const ground='#f4f0e8',ink='#313b32',muted='#837761';
    ctx.fillStyle=ground;ctx.fillRect(0,0,1600,2400);
    ctx.fillStyle=ink;
    ctx.font='600 29px system-ui,"Malgun Gothic",sans-serif';
    ctx.fillText('DAILYCOACHING',138,146);
    ctx.textAlign='right';ctx.font='24px system-ui,"Malgun Gothic",sans-serif';
    ctx.fillText('ART ATELIER   /   MOONJAR',1462,146);
    ctx.textAlign='left';
    // Artwork is drawn from the EXACT PNG bytes previewed and downloadable,
    // not from a separately reconstructed scene.
    ctx.fillStyle='#fffcf7';ctx.fillRect(130,208,1340,1536);
    ctx.drawImage(artwork,140,218,1320,1485);
    ctx.strokeStyle='#c4baab';ctx.lineWidth=1.5;ctx.strokeRect(140,218,1320,1485);
    ctx.beginPath();ctx.moveTo(140,1800);ctx.lineTo(1460,1800);ctx.stroke();
    ctx.fillStyle=muted;ctx.font='24px system-ui,"Malgun Gothic",sans-serif';
    ctx.fillText('빛을 담는 달항아리  ·  A형 공예 시안',140,1868);

    const title=planText(ctx,normalized.title,{maxWidth:1300,preferred:87,minimum:46,maxLines:2,label:'작품 제목'});
    const sentence=planText(ctx,normalized.sentence,{maxWidth:1300,preferred:46,minimum:32,maxLines:2,label:'한 문장'});
    if(title.lines.length){
      ctx.fillStyle=ink;
      ctx.font='500 '+title.size+'px "Moonjar Gowun","Batang",serif';
      const start=title.lines.length===2?1958:2010;
      title.lines.forEach((line,i)=>ctx.fillText(line,140,start+i*80));
    }
    if(sentence.lines.length){
      ctx.fillStyle='#56685c';
      ctx.font='500 '+sentence.size+'px "Moonjar Gowun","Batang",serif';
      const start=title.lines.length===2?2167:title.lines.length?2135:2010;
      sentence.lines.forEach((line,i)=>ctx.fillText(line,140,start+i*55));
    }
    ctx.strokeStyle='#c4baab';ctx.beginPath();ctx.moveTo(140,2290);ctx.lineTo(1460,2290);ctx.stroke();
    ctx.fillStyle='#616d63';ctx.font='22px system-ui,"Malgun Gothic",sans-serif';
    ctx.fillText('나를 담고, 다시 보다.',140,2338);
    ctx.textAlign='right';ctx.fillText('개인 기록 기본 비공개',1460,2338);
    return await asPNG(canvas);
  }finally{
    canvas.width=0;canvas.height=0;
    artwork.close?.();
  }
}
