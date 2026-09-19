import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSaju } from '../js/manse.js';
import { analyze, compose, factSheet, sipsinOf, SIPSIN } from '../js/reading.js';

test('십신 관계', () => {
  assert.equal(SIPSIN[sipsinOf(0, 0)], '비견'); // 甲→甲
  assert.equal(SIPSIN[sipsinOf(0, 1)], '겁재'); // 甲→乙
  assert.equal(SIPSIN[sipsinOf(0, 2)], '식신'); // 甲→丙
  assert.equal(SIPSIN[sipsinOf(0, 3)], '상관'); // 甲→丁
  assert.equal(SIPSIN[sipsinOf(0, 4)], '편재'); // 甲→戊
  assert.equal(SIPSIN[sipsinOf(0, 5)], '정재'); // 甲→己
  assert.equal(SIPSIN[sipsinOf(0, 6)], '편관'); // 甲→庚
  assert.equal(SIPSIN[sipsinOf(0, 7)], '정관'); // 甲→辛
  assert.equal(SIPSIN[sipsinOf(0, 8)], '편인'); // 甲→壬
  assert.equal(SIPSIN[sipsinOf(0, 9)], '정인'); // 甲→癸
  assert.equal(SIPSIN[sipsinOf(1, 0)], '겁재'); // 乙→甲
  assert.equal(SIPSIN[sipsinOf(9, 2)], '정재'); // 癸→丙
});

test('분석과 풀이가 생성된다', () => {
  for (const p of [
    { year: 1990, month: 5, day: 5, hour: 23, minute: 30, gender: 'm', longitude: 126.98 },
    { year: 2001, month: 12, day: 31, hour: null, gender: 'f', longitude: null },
    { year: 1975, month: 2, day: 4, hour: 3, minute: 0, gender: 'f', longitude: 129.08 },
  ]) {
    const s = computeSaju(p);
    const a = analyze(s, { now: new Date('2026-09-19') });
    assert.equal(a.elementCount.reduce((x, y) => x + y, 0), p.hour === null ? 6 : 8);
    assert.ok(['신강', '신약', '중화'].includes(a.strength));
    const sections = compose(s, a, { name: '민수' });
    assert.ok(sections.length >= 7);
    for (const sec of sections) for (const para of sec.paragraphs) assert.ok(!/undefined|NaN/.test(para), para);
    const fs = factSheet(s, a, { name: '민수' });
    assert.ok(fs.includes('일간'));
  }
});
