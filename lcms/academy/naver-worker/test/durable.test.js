import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { COURSE_ID } from '../src/domain.js';

test('workerd SQLite object keeps unique orders and cursor through a real runtime restart',async()=>{
  await fs.mkdir('.wrangler',{recursive:true});
  const dir=await fs.mkdtemp(path.resolve('.wrangler/persistence-test-'));
  const bundle=path.join(dir,'test-worker.js');
  const entry=new URL('../src/index.js',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');
  const script=`
    import Worker, {NaverIntegration} from ${JSON.stringify(entry.replaceAll('\\','/'))};
    export default Worker;
    export class Harness extends NaverIntegration {
      async fetch(request) {
        const url=new URL(request.url);
        if(url.pathname==='/observe') return this.service.exclusive(async()=>{
          const id='202609220000001';
          await this.service.observe({productOrderId:id,status:'PAYED',productId:'TEST',originalProductId:'',sellerProductCode:'',quantity:1,remainQuantity:1,claim:false,purchasedAt:'2026-09-22T00:00:00Z',buyerName:'Test',buyerPhone:'01000000000',gift:false});
          await this.storage.put('sync:cursor',{from:'2026-09-22T00:00:00Z',sequence:'9',to:'2026-09-22T01:00:00Z'});
          return Response.json({ok:true});
        });
        if(url.pathname==='/probe') return Response.json({orders:await this.service.store.list(),cursor:await this.storage.get('sync:cursor')});
        return super.fetch(request);
      }
    }
  `;
  await build({stdin:{contents:script,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',outfile:bundle,logLevel:'silent'});
  const options=convertV4MiniflareOptions({modules:true,scriptPath:bundle,compatibilityDate:'2026-09-22',durableObjects:{INTEGRATION:{className:'Harness',useSQLite:true}},resourcePersistencePath:path.join(dir,'storage'),bindings:{REGISTRATION_SECRET:randomUUID()+randomUUID(),DRY_RUN:'true',PRODUCT_MAPPING_VERIFIED:'true',PRODUCT_MAPPINGS:JSON.stringify([{field:'productId',value:'TEST',courseId:COURSE_ID}])}});
  let mf;
  try {
    mf=new Miniflare(options);let ns=await mf.getDurableObjectNamespace('INTEGRATION'),stub=ns.get(ns.idFromName('lmc-naver-v1'));
    const responses=await Promise.all(Array.from({length:100},()=>stub.fetch('https://internal/observe')));
    assert(responses.every(r=>r.status===200));
    let probe=await(await stub.fetch('https://internal/probe')).json();assert.equal(probe.orders.length,1);
    await mf.dispose();mf=new Miniflare(options);ns=await mf.getDurableObjectNamespace('INTEGRATION');stub=ns.get(ns.idFromName('lmc-naver-v1'));
    probe=await(await stub.fetch('https://internal/probe')).json();assert.equal(probe.orders.length,1);assert.equal(probe.cursor.sequence,'9');
    assert.equal((await(await mf.dispatchFetch('https://public/health')).json()).service,'lmc-naver-integration');
  } finally {
    if(mf)await mf.dispose();
    if(!dir.startsWith(path.resolve('.wrangler')+path.sep))throw new Error('Unsafe cleanup path');
    await fs.rm(dir,{recursive:true,force:true});
  }
});
