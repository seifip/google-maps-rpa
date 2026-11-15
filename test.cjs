const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const api = require('./console-script.js');
const url = 'https://www.google.com/maps/place/Restaurant/data=!1s123';
test('explicit cuisine classification only', () => {
  for (const c of ['Italian restaurant','Greek restaurant','Turkish restaurant']) assert.equal(api.classify(c),'Mediterranean');
  assert.equal(api.classify(' · Mexican restaurant '),'Mexican');
  for (const c of ['Restaurant','Mediterranean restaurant','Moroccan restaurant','Italian sounding name','constructor','__proto__']) assert.equal(api.classify(c),null);
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
