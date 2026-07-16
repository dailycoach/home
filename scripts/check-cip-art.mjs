import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const html = read('lcms/business-achievements.html');
const sharedCss = read('lcms/cip-art-direction.css');
const businessCss = read('lcms/business-art.css');

assert(html.includes('./cip-art-direction.css'), 'Project Experience is missing shared CIP art direction');
assert(html.includes('./business-art.css'), 'Project Experience is missing business art direction');
assert(html.includes('art-experience-hero'), 'Project Experience editorial hero is missing');
assert(html.includes('FIELD\nARCHIVE') || html.includes('FIELD<br />ARCHIVE'), 'Project archive display typography is missing');
assert(html.includes('2010—NOW'), 'Project Experience timeline headline is missing');
assert(html.includes('서울시 관내 <strong>모든 초·중·고 학생</strong>'), 'Flagship Seoul education record changed');

const projectCards = (html.match(/class="project-card"/g) || []).length;
assert(projectCards === 7, `Expected 7 archive project cards, found ${projectCards}`);
assert(html.includes('System Record 01'), 'Flagship record 01 is missing');
assert(html.includes('art-timeline'), 'Editorial timeline is missing');
assert((html.match(/class="art-time"/g) || []).length === 5, 'Timeline must contain five era markers');

for (const token of ['--art-electric', '--art-mint', '--art-orange', '--art-violet', '.art-display']) {
  assert(sharedCss.includes(token), `Shared art token missing: ${token}`);
}
for (const selector of ['.art-experience-hero', '.archive-grid', '.art-timeline']) {
  assert(businessCss.includes(selector), `Business art selector missing: ${selector}`);
}

console.log('CIP contemporary art direction checks passed.');
