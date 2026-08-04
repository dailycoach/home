import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(String(key)) ? this.values.get(String(key)) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

const localStorage = new MemoryStorage();
const window = {
  location: { search: '', pathname: '/lcms/academy/index.html' }
};
const document = {
  addEventListener() {},
  body: { dataset: { academyPage: 'index' } }
};

const context = vm.createContext({
  console,
  Date,
  JSON,
  Math,
  Number,
  Object,
  String,
  Array,
  Set,
  URL,
  URLSearchParams,
  encodeURIComponent,
  localStorage,
  window,
  document,
  fetch: async () => {
    throw new Error('network access is not expected in the progress-store test');
  }
});
window.window = window;

vm.runInContext(readFileSync('lcms/academy/academy.js', 'utf8'), context, {
  filename: 'lcms/academy/academy.js'
});

const store = window.RSEduAcademyProgress;
assert.ok(store, 'Academy must expose its browser progress adapter');

const courseId = 'lmc-lifetime-management-counselor';
const studentA = 'REG-20260725000000-AAAA1111';
const studentB = 'REG-20260725000000-BBBB2222';
const studentC = 'REG-20260725000000-CCCC3333';
const legacy = {
  completed: { [courseId]: ['week-01-part-01'] },
  notes: { [`${courseId}:week-01-part-01`]: '기존 수강생 기록' },
  lastViewed: { [courseId]: 'week-01-part-01' },
  playback: { [`${courseId}:week-01-part-01`]: 35 }
};

localStorage.setItem('rsedu-academy-progress:v1', JSON.stringify(legacy));
store.setAuthenticatedStudent(studentA);
assert.equal(store.storageKey(), `rsedu-academy-progress:v2:${encodeURIComponent(studentA)}`);
assert.equal(store.load().notes[`${courseId}:week-01-part-01`], '기존 수강생 기록');
assert.equal(localStorage.getItem('rsedu-academy-progress:v1'), null, 'legacy progress must be removed after its one-time migration');

const progressA = store.load();
progressA.notes[`${courseId}:week-01-part-02`] = 'A 전용 메모';
store.save(progressA);

store.setAuthenticatedStudent(studentB);
assert.deepEqual(
  JSON.parse(JSON.stringify(store.load())),
  { completed: {}, notes: {}, lastViewed: {}, playback: {}, finalWeeks: {}, updatedAt: null },
  'a second student must not inherit the first student progress'
);
const progressB = store.load();
progressB.notes[`${courseId}:week-01-part-02`] = 'B 전용 메모';
store.save(progressB);

store.setAuthenticatedStudent(studentA);
assert.equal(store.load().notes[`${courseId}:week-01-part-02`], 'A 전용 메모');
assert.notEqual(store.load().notes[`${courseId}:week-01-part-02`], 'B 전용 메모');

store.setAuthenticatedStudent('');
assert.deepEqual(
  JSON.parse(JSON.stringify(store.load())),
  { completed: {}, notes: {}, lastViewed: {}, playback: {}, finalWeeks: {}, updatedAt: null },
  'public pages without a current authenticated student must receive empty progress'
);
assert.equal(store.save(legacy), false, 'unauthenticated progress writes must be ignored');

localStorage.setItem('rsedu-academy-progress:v1', JSON.stringify({
  notes: { [`${courseId}:week-01-part-03`]: '뒤늦게 생긴 레거시 기록' }
}));
store.setAuthenticatedStudent(studentC);
assert.equal(store.load().notes[`${courseId}:week-01-part-03`], undefined, 'legacy data must never migrate to a second student');
assert.equal(localStorage.getItem('rsedu-academy-progress:v1'), null);

console.log('LMC per-student browser progress isolation: 14 checks passed');
