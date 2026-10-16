export const clone = value => structuredClone(value);
export const uid = () => crypto.randomUUID().replaceAll('-', '_');
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const angle = n => ((n + 180) % 360 + 360) % 360 - 180;
export const canvasVariantOf = scene => scene.canvasVariant || 'legacy-outline-v3';
export function backgroundKey(scene) {
  const variant=canvasVariantOf(scene);
  if(!['legacy-outline-v3','porcelain-v2'].includes(variant)) throw new Error('지원하지 않는 달항아리 바탕입니다.');
  if(!['light','dark'].includes(scene.theme)) throw new Error('지원하지 않는 바탕 색상입니다.');
  return variant==='porcelain-v2' ? `porcelain-${scene.theme}` : `canvas-${scene.theme}`;
}
export function scaledDimensions(width, height, factor) {
  // Keep floating-point products strictly within the schema's inclusive bounds.
  const margin = 1e-6;
  const f = clamp(factor, Math.max((16+margin)/width,(16+margin)/height), Math.min((1600-margin)/width,(1800-margin)/height));
  return {width: width*f, height: height*f};
}
const length = s => [...s].length;

export function validateProject(data, schema, manifest) {
  const errors = [];
  const fail = (path, msg) => { if (errors.length < 12) errors.push(`${path}: ${msg}`); };
  function walk(value, rule, path, depth = 0) {
    if (depth > 24) { fail(path, '구조가 너무 깊습니다'); return; }
    if (rule.$ref) rule = rule.$ref.split('/').slice(1).reduce((r, k) => r[k], schema);
    if ('const' in rule && value !== rule.const) fail(path, '지원하지 않는 형식 또는 버전입니다');
    if (rule.enum && !rule.enum.includes(value)) fail(path, '허용되지 않은 값입니다');
    const type = rule.type;
    const ok = type === undefined || (type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value) : type === 'array' ? Array.isArray(value) : type === 'integer' ? Number.isInteger(value) : type === 'number' ? typeof value === 'number' && Number.isFinite(value) : typeof value === type);
    if (!ok) { fail(path, `${type} 형식이 필요합니다`); return; }
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity)) fail(path, '수치가 허용 범위를 벗어났습니다');
    } else if (typeof value === 'string') {
      if (length(value) > (rule.maxLength ?? Infinity)) fail(path, '글자 수 제한을 넘었습니다');
      if (rule.pattern && !new RegExp(rule.pattern).test(value)) fail(path, '식별자 형식이 맞지 않습니다');
      if (rule.format === 'date-time' && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value)))) fail(path, '날짜 형식이 맞지 않습니다');
    } else if (Array.isArray(value)) {
      if (value.length > (rule.maxItems ?? Infinity)) { fail(path, '항목 수 제한을 넘었습니다'); return; }
      value.forEach((v, i) => walk(v, rule.items, `${path}[${i}]`, depth + 1));
    } else if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length > (rule.maxProperties ?? Infinity)) fail(path, '항목 수 제한을 넘었습니다');
      for (const k of rule.required || []) if (!Object.hasOwn(value, k)) fail(`${path}.${k}`, '필수 구조가 없습니다');
      for (const k of keys) {
        if (['__proto__', 'prototype', 'constructor'].includes(k)) { fail(path, '허용되지 않은 구조 키입니다'); continue; }
        if (rule.propertyNames) walk(k, rule.propertyNames, path, depth + 1);
        const child = rule.properties?.[k];
        if (child) walk(value[k], child, `${path}.${k}`, depth + 1);
        else if (rule.additionalProperties === false) fail(`${path}.${k}`, '알 수 없는 필드입니다');
        else if (typeof rule.additionalProperties === 'object') walk(value[k], rule.additionalProperties, `${path}.${k}`, depth + 1);
      }
    }
  }
  walk(data, schema, 'project');
  if (errors.length) return errors;
  const assets = new Map(manifest.pieces.map(a => [a.id, a]));
  function sceneCheck(scene, path) {
    const ids = new Set();
    scene.nodes.forEach(n => {
      if (ids.has(n.instanceId)) fail(path, '조각 ID가 중복되었습니다');
      ids.add(n.instanceId);
      const asset = assets.get(n.assetId);
      if (!asset) fail(path, '알 수 없는 자개 ID입니다');
      else if (Math.abs(n.width / n.height / (asset.width / asset.height) - 1) > 0.01) fail(path, '자개 원본 비율과 다릅니다');
    });
    return ids;
  }
  const ids = sceneCheck(data.scene, 'scene');
  Object.keys(data.pieceNotes).forEach(id => { if (!ids.has(id)) fail('pieceNotes', '연결된 조각이 없는 기록입니다'); });
  const snapshots = new Set();
  data.snapshots.forEach(s => {
    if (snapshots.has(s.id)) fail('snapshots', '스냅샷 ID가 중복되었습니다');
    snapshots.add(s.id); sceneCheck(s.scene, 'snapshot.scene');
  });
  return errors;
}

export function parseImport(text, schema, manifest) {
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024) throw new Error('편집 파일은 5MiB 이하만 열 수 있어요.');
  let doc;
  try { doc = JSON.parse(text); } catch { throw new Error('JSON 문법을 읽을 수 없어요. 기존 작업은 그대로 유지됩니다.'); }
  const errors = validateProject(doc, schema, manifest);
  if (errors.length) throw new Error(errors.join('\n'));
  return doc;
}

export function newProject(empty, mode = 'guided') {
  const doc = clone(empty), now = new Date().toISOString();
  return Object.assign(doc, {projectId: uid(), revision: 0, createdAt: now, updatedAt: now, mode, currentScene: mode === 'free' ? 'arrange' : 'arrival'});
}
export function importAsNew(doc) {
  const copy = clone(doc), now = new Date().toISOString();
  return Object.assign(copy, {projectId: uid(), revision: 0, createdAt: now, updatedAt: now});
}

export class Editor {
  constructor(doc, manifest, onChange = () => {}) {
    this.doc = clone(doc); this.manifest = manifest; this.onChange = onChange;
    this.past = []; this.future = []; this.selected = null;
  }
  get node() { return this.doc.scene.nodes.find(n => n.instanceId === this.selected); }
  stamp() { this.doc.revision++; this.doc.updatedAt = new Date().toISOString(); this.onChange(this.doc); }
  artwork() { return clone({scene: this.doc.scene, pieceNotes: this.doc.pieceNotes}); }
  commit(change) {
    const before = this.artwork(); change(this.doc);
    if (JSON.stringify(before) === JSON.stringify(this.artwork())) return;
    this.past.push(before); if (this.past.length > 100) this.past.shift();
    this.future = []; this.stamp();
  }
  undo() {
    if (!this.past.length) return;
    this.future.push(this.artwork()); Object.assign(this.doc, this.past.pop()); this.stamp();
  }
  redo() {
    if (!this.future.length) return;
    this.past.push(this.artwork()); Object.assign(this.doc, this.future.pop()); this.stamp();
  }
  add(assetId) {
    if (this.doc.scene.nodes.length >= 200) throw new Error('한 작업에는 조각을 200개까지 놓을 수 있어요. 편집 파일로 보관한 뒤 새 작업을 시작할 수 있습니다.');
    const a = this.manifest.pieces.find(a => a.id === assetId);
    if (!a) throw new Error('제공되지 않은 자개입니다.');
    const size = 200 / Math.max(a.width, a.height), instanceId = uid();
    this.commit(d => { d.scene.nodes.push({instanceId, kind: 'piece', assetId, x: 760 + (d.scene.nodes.length % 5) * 24, y: 860 + (d.scene.nodes.length % 5) * 24, width: a.width * size, height: a.height * size, rotation: 0, locked: false}); d.pieceNotes[instanceId] = {label: '', memory: ''}; });
    this.selected = instanceId;
  }
  transform(patch) {
    if (!this.node || this.node.locked) return;
    this.commit(() => {
      const n = this.node;
      if (patch.x !== undefined) n.x = clamp(patch.x, 0, 1600);
      if (patch.y !== undefined) n.y = clamp(patch.y, 0, 1800);
      if (patch.rotation !== undefined) n.rotation = angle(patch.rotation);
      if (patch.factor !== undefined) {
        Object.assign(n, scaledDimensions(n.width,n.height,patch.factor));
      }
    });
  }
  duplicate() {
    const n = this.node; if (!n) return;
    if (this.doc.scene.nodes.length >= 200) throw new Error('조각 200개 상한에 도달했어요.');
    const id = uid();
    this.commit(d => { const c = clone(n); Object.assign(c, {instanceId: id, x: clamp(c.x + 40, 0, 1600), y: clamp(c.y + 40, 0, 1800)}); d.scene.nodes.push(c); d.pieceNotes[id] = clone(d.pieceNotes[n.instanceId] || {label: '', memory: ''}); });
    this.selected = id;
  }
  remove() {
    if (!this.node || this.node.locked) return;
    const id = this.selected;
    this.commit(d => { d.scene.nodes = d.scene.nodes.filter(n => n.instanceId !== id); delete d.pieceNotes[id]; }); this.selected = null;
  }
  reorder(delta) {
    if (!this.node || this.node.locked) return;
    this.commit(d => { const list = d.scene.nodes, i = list.findIndex(n => n.instanceId === this.selected), j = clamp(i + delta, 0, list.length - 1); list.splice(j, 0, list.splice(i, 1)[0]); });
  }
  toggleLock() { if (this.node) this.commit(() => { this.node.locked = !this.node.locked; }); }
  clear() { this.commit(d => { d.scene.nodes = []; d.pieceNotes = {}; }); this.selected = null; }
  theme(theme) { this.commit(d => { d.scene.theme = theme; }); }
  setCanvas(variant,theme) {
    backgroundKey({canvasVariant:variant,theme});
    this.commit(d => { d.scene.canvasVariant=variant; d.scene.theme=theme; });
  }
  text(section, field, value) {
    const target = section === 'piece' ? (this.doc.pieceNotes[this.selected] ||= {label:'', memory:''}) : section === 'title' ? this.doc : this.doc.reflections[section];
    if (target[field] === value) return;
    target[field] = value; this.stamp();
  }
  navigate(scene, mode = this.doc.mode) { this.doc.currentScene = scene; this.doc.mode = mode; this.stamp(); }
  snapshot(replaceIndex = null) {
    if (this.doc.snapshots.length >= 3 && replaceIndex === null) throw new Error('남긴 배치는 세 개까지 보관할 수 있어요. 교체할 배치를 선택해 주세요.');
    const shot = {id: uid(), label: `남긴 배치 ${this.doc.snapshots.length + 1}`, createdAt: new Date().toISOString(), scene: clone(this.doc.scene)};
    if (replaceIndex === null) this.doc.snapshots.push(shot); else this.doc.snapshots.splice(replaceIndex, 1, shot);
    this.stamp();
  }
}

export function drawScene(ctx, scene, images) {
  ctx.clearRect(0, 0, 1600, 1800);
  ctx.drawImage(images.get(backgroundKey(scene)), 0, 0, 1600, 1800);
  for (const n of scene.nodes) {
    ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(n.rotation * Math.PI / 180);
    ctx.drawImage(images.get(n.assetId), -n.width / 2, -n.height / 2, n.width, n.height); ctx.restore();
  }
}
