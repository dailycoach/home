import vm from 'node:vm';
import fs from 'node:fs';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { COURSE_ID } from '../src/domain.js';
import { MockNaverAdapter } from '../src/naver.js';
import { AppsScriptBridge } from '../src/bridge.js';
import { IntegrationService } from '../src/service.js';

export class MemoryStorage {
  constructor() { this.map = new Map(); }
  async get(key) { return structuredClone(this.map.get(key)); }
  async put(key, value) { this.map.set(key, structuredClone(value)); }
  async delete(key) { return this.map.delete(key); }
  async list({ prefix = '', startAfter = '', limit = 1000 } = {}) {
    return new Map([...this.map].filter(([key]) => key.startsWith(prefix) && key > startAfter).sort(([a],[b])=>a.localeCompare(b)).slice(0,limit).map(([key,value])=>[key,structuredClone(value)]));
  }
}
export const fixture = (status = 'PAYED', id = '202609220000001', extra = {}) => ({
  order: { ordererName: '테스트 주문자', ordererTel: '01000000000', paymentDate: '2026-09-22T10:00:00.000+09:00' },
  productOrder: { productOrderId: id, productOrderStatus: status, productId: 'MOCK-LMC-PRODUCT', originalProductId: 'MOCK-ORIGIN', sellerProductCode: 'MOCK-SELLER', quantity: 1, ...extra }
});
export const student = { studentName: '테스트 수강생', email: 'learner@example.test', phone: '01000000000', consent: true };

class Sheet {
  constructor(rows = [[], []]) { this.rows = rows; }
  getLastRow() { return this.rows.length; }
  getRange(row, col, height = 1, width = 1) {
    const sheet = this;
    return {
      getRow: () => row,
      getValues: () => Array.from({ length: height }, (_,r)=>Array.from({length:width},(_,c)=>sheet.rows[row+r-1]?.[col+c-1] ?? '')),
      getValue: () => sheet.rows[row-1]?.[col-1] ?? '',
      setValues(values) { for(let r=0;r<height;r++) for(let c=0;c<width;c++) { sheet.rows[row+r-1] ||= []; sheet.rows[row+r-1][col+c-1]=values[r][c]; } return this; },
      setValue(value) { return this.setValues([[value]]); },
      clearContent() { return this.setValues(Array.from({length:height},()=>Array(width).fill(''))); },
      createTextFinder(text) { return { matchEntireCell() {return this;}, findNext() { for(let r=0;r<height;r++) if(String(sheet.rows[row+r-1]?.[col-1])===String(text)) return {getRow:()=>row+r}; return null; } }; }
    };
  }
  appendRow(row) { this.rows.push(row); }
}
export function gasHarness() {
  const sheets = new Map(['수강생','세션','발송로그','설정','과정설정','네이버연동'].map(name=>[name,new Sheet()]));
  sheets.get('과정설정').rows.push([COURSE_ID,'LMC 평생진로상담사 2급','https://example.test/enter','',180,'LMC','support@example.test','R2','PRIVATE_WORKER_SIGNED_URL','활성']);
  const ss = { getSheetByName: name => sheets.get(name), insertSheet: name => { const sheet=new Sheet();sheets.set(name,sheet);return sheet; } };
  const props = new Map(Object.entries({ NAVER_SHARED_SECRET: randomUUID()+randomUUID(), CODE_PEPPER:randomUUID()+randomUUID(), SESSION_PEPPER:randomUUID()+randomUUID(), WORKER_SHARED_SECRET:randomUUID()+randomUUID(), NAVER_AUTO_PROVISION_ENABLED:'true', NAVER_AUTO_SUSPEND_ENABLED:'true', NAVER_DRY_RUN:'false' }));
  const mail = [], cache = new Map(); let locked = false, issueCount = 0;
  const state = { failMail: false, failAfterMail: false };
  const context = vm.createContext({
    console: {log(){},warn(){},error(){}}, Date, Math,
    PropertiesService: {getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},
    SpreadsheetApp: {openById:()=>ss,flush(){}},
    LockService: {getScriptLock:()=>({waitLock(){if(locked)throw new Error('NESTED_LOCK');locked=true;},releaseLock(){locked=false;}})},
    CacheService: {getScriptCache:()=>({get:key=>cache.get(key),put:(key,value)=>cache.set(key,value),remove:key=>cache.delete(key)})},
    Utilities: {
      getUuid:randomUUID, Charset:{UTF_8:'utf8'}, DigestAlgorithm:{SHA_256:'sha256'},
      computeDigest:(alg,text)=>[...createHash('sha256').update(text).digest()],
      computeHmacSha256Signature:(text,key)=>[...createHmac('sha256',key).update(text).digest()],
      base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url'),
      formatDate:date=>date.toISOString().slice(0,10)
    },
    MailApp: {sendEmail(value){if(state.failMail)throw new Error('MOCK_MAIL_FAILURE');mail.push(value);if(state.failAfterMail)throw new Error('MOCK_ACK_LOST');}},
    ContentService:{MimeType:{JSON:'application/json'},createTextOutput:text=>({setMimeType:()=>({text})})},
    ScriptApp:{getProjectTriggers:()=>[],newTrigger:()=>({timeBased(){return this;},atHour(){return this;},everyDays(){return this;},create(){}})}
  });
  for (const file of ['Code.gs','DataHelpers.gs','Provisioning.gs','Api.gs','NaverIntegration.gs']) vm.runInContext(fs.readFileSync(new URL(`../../apps-script/${file}`,import.meta.url),'utf8'),context,{filename:file});
  const original = context.generateAccessCode_; context.generateAccessCode_ = () => {issueCount++;return original();};
  const fetcher = async (url, options) => {
    const result=context.doPost({postData:{contents:options.body}});
    return new Response(result.text,{headers:{'Content-Type':'application/json'}});
  };
  return {context,ss,sheets,props,mail,state,fetcher,get issueCount(){return issueCount;},get locked(){return locked;}};
}
export function setup(details = [fixture()]) {
  const gas=gasHarness(), storage=new MemoryStorage(), adapter=new MockNaverAdapter(details);
  const env={REGISTRATION_SECRET:randomUUID()+randomUUID(), NAVER_SYNC_ENABLED:'true',NAVER_AUTO_PROVISION_ENABLED:'true',NAVER_AUTO_SUSPEND_ENABLED:'true',DRY_RUN:'false',PRODUCT_MAPPING_VERIFIED:'true',PRIVACY_POLICY_VERIFIED:'true',PRODUCT_MAPPINGS:JSON.stringify([{field:'productId',value:'MOCK-LMC-PRODUCT',courseId:COURSE_ID}]),SYNC_START_AT:'2026-09-22T00:00:00Z',APPS_SCRIPT_ACCESS_URL:'https://script.google.com/macros/s/mock-only/exec',APPS_SCRIPT_SHARED_SECRET:gas.props.get('NAVER_SHARED_SECRET')};
  env.REGISTRATION_MODE='production';
  const bridge=new AppsScriptBridge(env,gas.fetcher), service=new IntegrationService(storage,adapter,bridge,env);
  return {gas,storage,adapter,env,bridge,service};
}
export async function registration(setupValue, id = '202609220000001') {
  const {service}=setupValue;
  const {token}=await service.exclusive(()=>service.verify({productOrderId:id,buyerName:'테스트 주문자',buyerPhone:'01000000000'},'192.0.2.1'));
  return {token,complete:()=>service.exclusive(()=>service.register({...student,token},'192.0.2.1'))};
}
