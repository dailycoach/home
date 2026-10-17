// Unit-level DOM harness for mobile narrative and preview wiring.
// It does not replace real Android/iOS browser and touch validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const story = JSON.parse(readFileSync(new URL('../../activities/moonjar/data/story.json',import.meta.url),'utf8'));
const source = readFileSync(new URL('../../activities/moonjar/src/app.js',import.meta.url),'utf8')
  .replace(/^import .*;\n/gm,'')
  .replace(/init\(\)\.catch\([\s\S]*$/,'');

function harness() {
  const elements = new Map();
  let renderCount = 0;
  function stub(tag = 'div') {
    const e = {
      tag, attrs:{}, dataset:{}, children:[], textContent:'', hidden:false,
      classList:{add(){},remove(){},toggle(){}},
      setAttribute(k,v) {
        this.attrs[k] = String(v);
        if(k === 'data-action') this.dataset.action = String(v);
        if(k === 'class') this.className = String(v);
      },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(){}, querySelector(){return null;},
      showModal(){}, close(){},
    };
    return e;
  }
  for(const key of ['#main','#modal','#modal-body','#modal-title','#modal-close','#import-file','#notice','#scene-lead','#look-prompt','#controls-panel','#story-panel']) elements.set(key,stub());
  const document = {
    querySelector:key=>elements.get(key)||null,
    querySelectorAll:()=>[],
    createElement:stub, createElementNS:(_ns,tag)=>stub(tag),
    addEventListener(){},
  };
  const context = vm.createContext({
    document,window:{addEventListener(){}},navigator:{},location:{hash:''},setTimeout(){},clearTimeout(){},
    console,fixtureStory:story,matchMedia:()=>({matches:false}),
    renderSVG(){renderCount++;},
  });
  vm.runInContext(source+`
    globalThis.moonjarUX = {
      renderSceneLead,renderLookPrompt,renderControls,renderStory,inputField,
      set(mode,scene) {
        story=globalThis.fixtureStory;materials={};viewScene=scene;
        const piece={instanceId:'n1',assetId:'A01',rotation:0,width:200,height:200,locked:false,x:500,y:700};
        editor={doc:{mode,scene:{nodes:[piece],theme:'light'},pieceNotes:{n1:{label:'',memory:''}},reflections:{return:{noticed:'',action:''}},title:''},selected:'n1',get node(){return this.doc.scene.nodes[0];}};
      }
    };
  `,context);
  return {ui:context.moonjarUX,elements,renders:()=>renderCount};
}
function collectText(node) {
  return [node.textContent||'',...(node.children||[]).filter(Boolean).map(collectText)].join(' ');
}
function hasAction(node,action) {
  return node.dataset?.action === action || (node.children||[]).some(child=>child&&hasAction(child,action));
}

test('guided mode displays the scene question before decorating; free mode does not',()=>{
  const {ui,elements}=harness();
  ui.set('guided','arrival');ui.renderSceneLead();
  const lead=elements.get('#scene-lead');
  assert.equal(lead.hidden,false);
  assert.match(collectText(lead),/지금 이 자리에 온 나는 어떤 상태인가요/);
  assert.equal(hasAction(lead,'panel:story'),true);
  ui.set('free','arrival');ui.renderSceneLead();
  assert.equal(lead.hidden,true);
  assert.equal(lead.children.length,0);
});

test('pause reflection shows the question for the current scene, without auto-interpreting placement',()=>{
  const {ui,elements}=harness();
  ui.set('guided','arrange');ui.renderLookPrompt();
  const prompt=elements.get('#look-prompt');
  assert.match(collectText(prompt),/무엇을 기준으로 이 자리를 고르고 있나요/);
  assert.equal(hasAction(prompt,'panel:story'),true);
});

test('mobile controls expose a close action and avoid redrawing a redundant tiny SVG artwork',()=>{
  const {ui,elements,renders}=harness();
  ui.set('guided','arrange');ui.renderControls();
  const panel=elements.get('#controls-panel');
  assert.equal(panel.children[0].className,'control-drawer-top');
  assert.equal(hasAction(panel,'panel:canvas'),true);
  assert.equal(renders(),0);
  assert.match(collectText(panel),/작품을 보며 조절하기/);
});

test('reflection text inputs carry native maximum length; last scene starts with noticed',()=>{
  const {ui}=harness();
  const field=ui.inputField('return',{id:'noticed',label:'알아차린 것',maxLength:120},'');
  const input=field.children.find(c=>c.tag==='input');
  assert.equal(input.attrs.maxlength,'120');
  assert.match(source,/return:'noticed'/);
});

test('a placed nacre piece prompts choices even when user stays on arrival',()=>{
  const {ui,elements}=harness();
  ui.set('guided','arrival');
  ui.renderLookPrompt();
  const prompt=elements.get('#look-prompt');
  assert.match(collectText(prompt),/무엇을 기준으로 이 자리를 고르고 있나요/);
  assert.doesNotMatch(collectText(prompt),/지금 이 자리에 온 나는 어떤 상태인가요/);
});

test('free decorating keeps only one optional reflection instead of repeating messages for each piece',()=>{
  const {ui,elements}=harness();
  ui.set('free','arrange');
  ui.renderStory();
  const record=elements.get('#story-panel');
  assert.match(collectText(record),/자개 하나하나에 뜻을 담지 않아도 괜찮습니다/);
  assert.equal(record.children.filter(child=>child.className==='record-field').length,1);
  assert.equal(hasAction(record,'finish'),true);
  assert.equal(hasAction(record,'piece-note'),false);
});

test('free looking is optional and points back to decorating',()=>{
  const {ui,elements}=harness();
  ui.set('free','arrange');ui.renderLookPrompt();
  const prompt=elements.get('#look-prompt');
  assert.match(collectText(prompt),/눈에 들어오는 곳/);
  assert.equal(hasAction(prompt,'panel:palette'),true);
  assert.equal(hasAction(prompt,'panel:story'),true);
});
