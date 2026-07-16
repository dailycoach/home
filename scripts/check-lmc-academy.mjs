import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const catalog = JSON.parse(read('lcms/academy/data/courses.json'));
assert(Array.isArray(catalog.courses), 'courses.json: courses must be an array');
assert(catalog.courses.length === 1, 'Academy must contain exactly one primary LMC course before expansion approval');

const course = catalog.courses[0];
assert(course.id === 'lmc-lifetime-management-counselor', 'Unexpected primary course id');
assert(course.qualificationNumber === '민간자격 제2013-1058호', 'LMC qualification number is missing or changed');
assert(Array.isArray(course.modules) && course.modules.length === 12, 'LMC curriculum must contain 12 modules');

course.modules.forEach((module, index) => {
  assert(module.week === index + 1, `Week order mismatch at module ${index + 1}`);
  assert(module.title && module.theory && module.practice, `Week ${index + 1} is missing title, theory, or practice`);
});

const requiredStyles = ['./ux-core.css', './ux-course.css', './ux-lesson.css', './art-direction.css'];
for (const file of ['lcms/academy/index.html', 'lcms/academy/course.html', 'lcms/academy/lesson.html']) {
  const html = read(file);
  for (const style of requiredStyles) assert(html.includes(style), `${file} is missing ${style}`);
  assert(html.includes('../cip-art-direction.css'), `${file} is missing shared CIP art direction`);
  assert(html.includes('./academy.js'), `${file} is missing academy.js`);
}

const academyIndex = read('lcms/academy/index.html');
assert(academyIndex.includes('academy-art-word'), 'Academy typographic hero is missing');
assert(academyIndex.includes('academy-art-poster'), 'Academy editorial poster is missing');
assert(academyIndex.includes('12 WEEKS'), 'Academy 12-week poster data is missing');

const academySource = [
  academyIndex,
  read('lcms/academy/course.html'),
  read('lcms/academy/lesson.html'),
  read('lcms/academy/academy.js'),
  read('lcms/academy/art-direction.css'),
  read('lcms/academy/data/courses.json')
].join('\n');

assert(!academySource.includes('KINGDOM 기초 코칭'), 'Legacy KINGDOM sample course returned to Academy');
assert(!academySource.includes('KGM210 결과해석 실무'), 'Legacy KGM210 sample course returned to Academy');
assert(academySource.includes('LMC 평생진로상담사'), 'LMC course identity is missing');
assert(academySource.includes('mobile-learning-bar'), 'Mobile learning controls are missing');
assert(academySource.includes('course-quicknav'), 'Course quick navigation is missing');
assert(academySource.includes('note-save-status'), 'Autosave status UI is missing');
assert(academySource.includes('art-academy-hero'), 'Academy contemporary art hero class is missing');

console.log('LMC Academy quality checks passed.');
