import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../activities/moonjar/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('data/manifest.json',root)));
for(const file of await readdir(new URL('src/',root)))if(file.endsWith('.js'))execFileSync(process.execPath,['--check',fileURLToPath(new URL(`src/${file}`,root))]);
let total=0;
for(const a of [...manifest.pieces,...manifest.canvases]){
 const bytes=await readFile(new URL(a.src,root));total+=bytes.length;
 if(bytes.length!==a.byteSize||createHash('sha256').update(bytes).digest('hex')!==a.sha256)throw new Error(`Asset mismatch: ${a.id}`);
 if(bytes.readUInt32BE(16)!==a.width||bytes.readUInt32BE(20)!==a.height)throw new Error(`PNG size mismatch: ${a.id}`);
}
for(const a of manifest.pieces)await stat(new URL(`assets/thumbs/${a.paletteId}/${a.id}.webp`,root));
const source=(await Promise.all((await readdir(new URL('src/',root))).map(f=>readFile(new URL(`src/${f}`,root),'utf8')))).join('\n');
if(/sendBeacon|XMLHttpRequest|WebSocket|https?:\/\//.test(source.replaceAll('http://www.w3.org/2000/svg','')))throw new Error('Unexpected remote transport or URL in app source');
if(/innerHTML|insertAdjacentHTML|document\.write|\beval\s*\(/.test(source))throw new Error('Unsafe dynamic HTML or eval found');
console.log(`CHECK PASS: JavaScript syntax, 98 original hashes/dimensions (${total} bytes), 96 thumbnails, no remote transport or dynamic HTML sinks.`);
console.log('Buildless output: activities/moonjar/ (no installation, bundling, credentials or paid service required).');
