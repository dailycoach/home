import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installNacreVisibility} from '../../activities/moonjar/src/nacre-visibility.js';

function harness() {
  const names=new Set(['studio']);
  const classList={contains:n=>names.has(n),add:n=>names.add(n),remove:n=>names.delete(n),
    toggle:(n,v)=>v?names.add(n):names.delete(n)};
  const root={classList,toolbar:null,note:null,querySelector(s){
    if(s==='.view-toolbar')return this.toolbar;
    if(s==='#nacre-visibility-switch')return this.toolbar?.button||null;
    if(s==='#nacre-visibility-note')return this.note;
    return null;
  }};
  const toolbar=()=>{
    root.toolbar={button:null,pause:{id:'pause'},querySelector(s){
      if(s==='#nacre-visibility-switch')return this.button;
      if(s==='.pause-button')return this.pause;
      return null;
    },insertBefore(b){this.button=b;},append(b){this.button=b;},
    insertAdjacentElement(where,n){assert.equal(where,'afterend');root.note=n;}};
  };
  const document={querySelector:s=>s==='#main'?root:null,
    createElement:tag=>{
      const attributes=new Map();
      return {tag,hidden:false,listeners:{},setAttribute(key,value){attributes.set(key,String(value));},
        getAttribute:key=>attributes.get(key),addEventListener(key,callback){this.listeners[key]=callback;},
        click(){this.listeners.click?.({stopPropagation(){}});},remove(){this.removed=true;}};
    }
  };
  let observer;
  class FakeObserver{constructor(fn){observer=fn;}observe(){}disconnect(){}}
  toolbar();
  return {root,document,toolbar,update:()=>observer([{type:'childList'}]),FakeObserver};
}

test('viewer guide is off by default, accessible, and switchable',()=>{
  const env=harness();
  const dispose=installNacreVisibility({document:env.document,Observer:env.FakeObserver});
  const button=env.root.toolbar.button;
  assert.ok(button);
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.equal(env.root.classList.contains('nacre-guide-visible'),false);
  button.click();
  assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(env.root.classList.contains('nacre-guide-visible'),true);
  assert.equal(env.root.note.hidden,false);
  assert.match(env.root.note.textContent,/원본 그대로/);
  button.click();
  assert.equal(button.getAttribute('aria-pressed'),'false');
  dispose();
  assert.equal(env.root.classList.contains('nacre-guide-visible'),false);
});

test('a rebuilt editor restores the choice but not outside the studio',()=>{
  const env=harness(),stop=installNacreVisibility({document:env.document,Observer:env.FakeObserver});
  env.root.toolbar.button.click();
  env.toolbar();env.update();
  const added=env.root.toolbar.button;
  assert.equal(added.getAttribute('aria-pressed'),'true');
  env.update();
  assert.equal(added,env.root.toolbar.button);
  env.root.classList.remove('studio');env.update();
  assert.equal(env.root.classList.contains('nacre-guide-visible'),false);
  stop();
});

test('no persistent artwork or public card is changed by the viewing aid',()=>{
  const js=readFileSync(new URL('../../activities/moonjar/src/nacre-visibility.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../../activities/moonjar/nacre-visibility.css',import.meta.url),'utf8');
  const html=readFileSync(new URL('../../activities/moonjar/index.html',import.meta.url),'utf8');
  assert.match(css,/\.studio\.nacre-guide-visible #art g\[data-node\] > image\[data-id\]/);
  assert.doesNotMatch(css,/\.result-page|\.card-preview|\.print-art|@page/);
  assert.doesNotMatch(js,/\bfetch\(|\bdownload\(|\bindexedDB\.|\blocalStorage\.|\bexportPNG\(/);
  assert.match(html,/nacre-visibility\.css/);
  assert.match(html,/nacre-visibility\.js/);
});
