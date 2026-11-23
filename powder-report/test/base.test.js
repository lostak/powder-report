// Base depth parsing (skiresort.info page text, Nov 22 2026). Run: node --test test/
const test = require('node:test'), assert = require('node:assert'), B = require('../base');
const page = (mtn, base, upd = '22 Nov 2026') => `<div>Update process</div><h3>Snow report in detail</h3><h4>Snow depths</h4><div>${mtn} cm Mountain (3676 m)</div><div>${base} cm Base (2743 m)</div><span>Updated on: ${upd}</span>`;
test('reads base + summit in inches and the report date', () => {
  assert.deepStrictEqual(B.parse(page(46, 46)), { base: 18, summit: 18, asOf: '22 Nov 2026' });
  assert.deepStrictEqual(B.parse(page(46, 5)), { base: 2, summit: 18, asOf: '22 Nov 2026' });
});
test('label: current reports only; a 0" base shows the summit', () => {
  const recent = new Date(Date.now() - 864e5).toUTCString().slice(5, 16);   // "21 Nov 2026"
  assert.strictEqual(B.label({ base: 18, summit: 18, asOf: recent }), 'base 18"');
  assert.strictEqual(B.label({ base: 2, summit: 18, asOf: recent }), 'base 2" / summit 18"');
  assert.strictEqual(B.label({ base: 0, summit: 18, asOf: recent }), 'summit 18"');
  assert.strictEqual(B.label({ base: 30, asOf: '1 Jan 2020' }), '', 'stale report hidden');
  assert.strictEqual(B.label({}), '');
});
