// Private, opt-in photo journal. Nothing is uploaded: every page is rendered
// locally using the exact saved artwork, with no automatic journal disclosure.
import {drawScene} from './domain.js';

const W=1600,H=2400,LEFT=158,RIGHT=1442,BOTTOM=2165,MAX_PAGES=24;
const SANS='"Moonjar Sans", "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const SERIF='"Moonjar Gowun", "Batang", "AppleMyungjo", "Noto Serif KR", serif';

// Only return populated personal entries. Selection and sharing are performed
// by the caller; collecting a field never opts it into the exported image.
export function collectPhotoEntries(doc,story){
  const entries=[];
  if(typeof doc.title==='string'&&doc.title.trim())
    entries.push({id:'title',label:'작품 제목',text:doc.title,kind:'title'});
  for(const scene of story.scenes||[]){
    for(const field of scene.fields||[]){
      const value=doc.reflections?.[scene.id]?.[field.id];
      if(typeof value==='string'&&value.trim())entries.push({
        id:`${scene.id}.${field.id}`,label:`${scene.name} · ${field.label}`,text:value,kind:'reflection'
      });
    }
  }
  for(const node of doc.scene?.nodes||[]){
    const note=doc.pieceNotes?.[node.instanceId];
    if(note&&(note.memory?.trim()||note.label?.trim()))entries.push({
      id:`piece.${node.instanceId}`,
      label:`자개 기록 · ${note.label?.trim()||node.assetId}`,
      text:note.memory?.trim()||note.label,kind:'reflection'
    });
  }
  return entries;
}

// Split by actual canvas text metrics, not by a fixed character limit. Keep
// spaces, emoji, user-entered line breaks and ALL selected characters.
export function wrapPhotoLines(ctx,text,size,width=RIGHT-LEFT){
  ctx.font=`500 ${size}px ${SANS}`;
  const output=[];
  for(const paragraph of String(text).replaceAll('\r','').split('\n')){
    if(!paragraph){output.push('');continue;}
    let line='';
    for(const char of paragraph){
      if(line&&ctx.measureText(line+char).width>width){
        output.push(line);line=char;
      }else line+=char;
    }
    if(line)output.push(line);
  }
  return output;
}

// Each item is positioned inside the printable area. A continuation heading
// repeats the original entry label; neither hidden text nor ellipses are used.
export function paginatePhotoEntries(ctx,entries){
  const pages=[{cover:true,items:[]}];
  let page=pages[0],y=1560;
  const next=()=>{
    if(pages.length>=MAX_PAGES)throw new Error('선택한 글이 너무 길어 24장을 넘습니다. 글을 나누어 선택해 저장해 주세요. 원문은 변경하지 않았습니다.');
    page={cover:false,items:[]};pages.push(page);y=485;
  };
  for(const entry of entries){
    if(typeof entry.text!=='string'||!entry.text.trim())continue;
    const heading=String(entry.label||'나의 기록'),isTitle=entry.kind==='title';
    const fontSize=isTitle?86:58,lineHeight=isTitle?118:91;
    const lines=wrapPhotoLines(ctx,entry.text,fontSize);
    if(y+54+lineHeight>BOTTOM)next();
    page.items.push({kind:'heading',text:heading,y});
    y+=57;
    for(const line of lines){
      if(y+lineHeight>BOTTOM){
        next();page.items.push({kind:'heading',text:heading+' (이어지는 글)',y});y+=57;
      }
      y+=lineHeight;
      page.items.push({kind:isTitle?'title':'line',text:line,y});
    }
    y+=40;
  }
  return pages;
}

function paintSheet(ctx,page,index,total,scene,images){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#EEEAE1';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#FBF9F4';ctx.fillRect(64,64,W-128,H-128);
  ctx.strokeStyle='#D3C9BA';ctx.lineWidth=2;ctx.strokeRect(64,64,W-128,H-128);
  ctx.textBaseline='alphabetic';ctx.textAlign='left';
  ctx.fillStyle='#75644D';ctx.font=`600 32px ${SANS}`;
  ctx.fillText('DAILYCOACHING   /   MOONJAR',LEFT,152);
  ctx.textAlign='right';ctx.font=`500 35px ${SERIF}`;
  ctx.fillText('빛을 담는 달항아리',RIGHT,151);
  ctx.textAlign='left';
  ctx.strokeStyle='#D0C6B8';ctx.beginPath();ctx.moveTo(LEFT,190);ctx.lineTo(RIGHT,190);ctx.stroke();
  if(page.cover){
    const scale=.70,artX=(W-1600*scale)/2,artY=221;
    ctx.fillStyle='#FFFFFF';ctx.fillRect(artX-5,artY-5,1600*scale+10,1800*scale+10);
    ctx.save();ctx.translate(artX,artY);ctx.scale(scale,scale);drawScene(ctx,scene,images);ctx.restore();
    ctx.strokeStyle='#D0C6B8';ctx.lineWidth=2;
    ctx.strokeRect(artX-5,artY-5,1600*scale+10,1800*scale+10);
    ctx.fillStyle='#75644D';ctx.font=`500 35px ${SANS}`;
    ctx.fillText('나의 작품과 내가 남긴 말',LEFT,1538);
  }else{
    ctx.fillStyle='#2D3835';ctx.font=`600 73px ${SERIF}`;
    ctx.fillText('내가 남긴 이야기',LEFT,318);
    const scale=.145;
    ctx.save();ctx.translate(1150,215);ctx.scale(scale,scale);
    drawScene(ctx,scene,images);ctx.restore();
    ctx.strokeStyle='#D0C6B8';ctx.strokeRect(1150,215,1600*scale,1800*scale);
  }
  for(const item of page.items){
    if(item.kind==='heading'){
      ctx.fillStyle='#8A7254';ctx.font=`600 38px ${SANS}`;
    }else if(item.kind==='title'){
      ctx.fillStyle='#282B27';ctx.font=`600 86px ${SANS}`;
    }else{
      ctx.fillStyle='#333630';ctx.font=`500 58px ${SANS}`;
    }
    ctx.fillText(item.text,LEFT,item.y);
  }
  ctx.strokeStyle='#D0C6B8';ctx.beginPath();ctx.moveTo(LEFT,2230);ctx.lineTo(RIGHT,2230);ctx.stroke();
  ctx.fillStyle='#766957';ctx.font=`500 29px ${SANS}`;
  ctx.fillText('나를 담고, 다시 보다',LEFT,2300);
  ctx.textAlign='right';ctx.fillText(`${String(index+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`,RIGHT,2300);
}

// Returns one PNG per page, reusing a single canvas to limit mobile memory.
// The caller keeps only the resulting Blob(s), never a remote URL.
export async function exportPhotoJournalPNGs(scene,materials,entries,scale=1){
  if(![.4,.5,1].includes(scale))throw new Error('지원하지 않는 사진 해상도입니다.');
  if(!Array.isArray(entries))throw new Error('사진에 넣을 기록을 다시 선택해 주세요.');
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('사진을 만들 작업 공간이 부족합니다.');
  const layout=document.createElement('canvas').getContext('2d');
  const pages=paginatePhotoEntries(layout,entries);
  const images=await materials.forScene(scene);
  const blobs=[];
  try{
    for(let i=0;i<pages.length;i++){
      ctx.setTransform(scale,0,0,scale,0,0);
      // Painting is done in logical 1600×2400 coordinates.
      ctx.save();ctx.scale(1/scale,1/scale);
      // Reapply the output scaling below without reducing layout fidelity.
      ctx.restore();
      ctx.setTransform(scale,0,0,scale,0,0);
      // Draw at full logical dimensions on a context whose transform is scaled.
      // paintSheet resets its transform internally: use an offscreen logical
      // backing canvas so 0.4/0.5 previews share exact geometry.
      const sheet=document.createElement('canvas');
      sheet.width=W;sheet.height=H;
      const sheetCtx=sheet.getContext('2d');
      if(!sheetCtx)throw new Error('사진을 만들 메모리가 부족합니다.');
      paintSheet(sheetCtx,pages[i],i,pages.length,scene,images);
      ctx.clearRect(0,0,W,H);
      ctx.drawImage(sheet,0,0,W,H);
      sheet.width=0;sheet.height=0;
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('사진 파일을 만들지 못했습니다.')),'image/png'));
      blobs.push(blob);
    }
    return blobs;
  }finally{
    canvas.width=0;canvas.height=0;images.clear();
  }
}
