const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const api = require('./console-script.js');
const url = 'https://www.google.com/maps/place/Restaurant/data=!1s123';
test('explicit cuisine classification only', () => {
  for (const c of ['Italian restaurant','Greek restaurant','Turkish restaurant']) assert.equal(api.classify(c),'Mediterranean');
  for (const c of ['Italian', 'Greek', 'Turkish', 'Pizza']) assert.equal(api.classify(c), 'Mediterranean');
  for (const c of ['Mexican', 'Taco', 'Burrito', 'Tex-Mex']) assert.equal(api.classify(c), 'Mexican');
  assert.equal(api.classify(' · Mexican restaurant '),'Mexican');
  for (const c of ['Restaurant','Mediterranean restaurant','Moroccan restaurant','Italian sounding name','constructor','__proto__']) assert.equal(api.classify(c),null);
});

// Minimal DOM doubles represent the observed saved-row structure. They implement
// only the selectors used by scan, so the tests also exercise row discovery.
function savedRow({tag = 'button', role, name = 'Example', category, note = '', closure = '', href} = {}) {
  const row = {
    tag, role, textContent: [name, category, note, closure].filter(Boolean).join(' '),
    matches(selector) { return selector === 'a[href]' && tag === 'a' && !!href; },
    getAttribute(name) { return name === 'href' ? href : null; },
    querySelector(selector) {
      if (selector === '.fontBodyMedium > div:last-child > div:last-child span:last-child') {
        return category == null ? null : {textContent: category};
      }
      if (selector === 'a[href*="/maps/place/"]') return null;
      throw new Error(`Unexpected selector: ${selector}`);
    }
  };
  const heading = {
    textContent: name,
    closest(selector) {
      const parts = selector.split(',').map(s => s.trim());
      return parts.some(s => s === tag || (s === '[role="button"]' && role === 'button')) ? row : null;
    }
  };
  return heading;
}
function scopeOf(...headings) {
  return {querySelectorAll(selector) {
    assert.equal(selector, '.fontHeadlineSmall');
    return headings;
  }};
}
test('scan reads native and role button rows including existing notes', () => {
  const report = api.scan({sourceList: 'Food', scope: scopeOf(
    savedRow({category: '· Cafe ', note: 'Existing private note'}),
    savedRow({tag: 'div', role: 'button', name: 'Another', category: 'Bistro '})
  )});
  assert.equal(report.inspected, 2);
  assert.equal(report.candidates[0].category, '· Cafe');
  assert.equal(report.candidates[0].target, 'Coffee');
  assert.equal(report.candidates[0].url, null);
  assert.equal(report.candidates[0].status, 'review: identity missing');
  assert.equal(report.candidates[1].category, 'Bistro');
  assert.equal(report.candidates[1].target, null);
});
test('scan retains missing fields and blocks closure removal until Heart is verified', () => {
  const rows = api.scan({sourceList: 'Food', scope: scopeOf(
    savedRow({name: 'No category'}),
    savedRow({name: 'Closed', category: 'Italian', closure: 'Permanently closed'})
  )}).candidates;
  assert.equal(rows[0].category, '');
  assert.equal(rows[0].url, null);
  assert.equal(rows[0].target, null);
  assert.equal(rows[1].closure, 'permanent');
  assert.equal(rows[1].heartMembership, 'unknown');
  assert.match(rows[1].status, /^blocked:/);
  assert.equal(api.plan([{name: 'Closed', category: 'Italian', text: 'Permanently closed', heartMembership: true}])[0].status, 'keep: Heart exception');
});
test('closed and unknown places retained for review', () => {
  const rows = api.plan([{name:'A',category:'Mexican restaurant',url,text:'Permanently closed',heartMembership:false}, {name:'B',category:'Restaurant',text:''}]);
  assert.equal(rows.length,2); assert.equal(rows[0].target,null); assert.equal(rows[0].closure,'permanent'); assert.match(rows[0].status,/removal candidate/);
  assert.equal(rows[1].target,null);
});
test('Heart membership protects permanent closures; unknown fails closed', () => {
  for (const [heartMembership, expected] of [[true,'keep: Heart exception'],[undefined,'blocked: verify Heart membership before removal'],['false','blocked: verify Heart membership before removal']]) {
    const row=api.plan([{name:'A',category:'Restaurant',url,text:'Permanently closed',heartMembership}])[0];
    assert.equal(row.status,expected);
    assert.doesNotMatch(row.status,/removal candidate/);
  }
});
test('temporary, conflicting and ordinary closing labels never propose removal', () => {
  for (const text of ['Temporarily closed', 'Temporarily closed Permanently closed', 'Closed now', 'Closes soon']) {
    const row = api.plan([{name:'A',category:'Restaurant',url,text}])[0];
    assert.doesNotMatch(row.status,/removal candidate/);
  }
});
test('deduplicates exact URLs, not names or missing identities', () => {
  const make = u => ({name:'same chain',category:'Italian restaurant',url:u});
  assert.equal(api.plan([make(url),make(url),make(url+'2'),make(null),make(null)]).length,4);
});
test('rejects non-place and external URLs', () => {
  for (const u of ['javascript:alert(1)','https://evil.com/maps/place/a','https://google.com.evil.com/maps/place/a','https://www.google.com/maps/search/a']) assert.equal(api.placeURL(u),null);
});
test('requires explicit source and bounded scope', () => {
  assert.throws(()=>api.scan());
  assert.throws(()=>api.scan({scope:{querySelectorAll:()=>[]},sourceList:'Food',limit:Infinity}));
  const result=api.scan({scope:{querySelectorAll:()=>[]},sourceList:'Food'});
  assert.equal(result.readOnly,true); assert.equal(result.inspected,0);
});
test('no mutation or unbounded execution primitives', () => {
  const source=fs.readFileSync(require.resolve('./console-script.js'),'utf8');
  assert.doesNotMatch(source,/\.click\(|fetch\(|XMLHttpRequest|setInterval\(|setTimeout\(|localStorage|innerHTML\s*=/);
});
