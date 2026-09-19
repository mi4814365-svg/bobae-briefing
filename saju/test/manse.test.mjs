import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayGanziIndex, ganzi, ganziName, solarToLunar, lunarToSolar, computeSaju, lunarMonthsOf } from '../js/manse.js';

test('일주 — 알려진 날짜', () => {
  assert.equal(ganziName(ganzi(dayGanziIndex(2000, 1, 1))), '戊午');
  assert.equal(ganziName(ganzi(dayGanziIndex(1900, 1, 1))), '甲戌');
  assert.equal(ganziName(ganzi(dayGanziIndex(1949, 10, 1))), '甲子');
});

test('음력 설날', () => {
  const cases = [[2024, 2, 10], [2025, 1, 29], [2026, 2, 17], [2023, 1, 22], [2020, 1, 25], [2000, 2, 5], [1990, 1, 27], [1985, 2, 20]];
  for (const [y, m, d] of cases) {
    assert.deepEqual(solarToLunar(y, m, d), { y, m: 1, d: 1, leap: false }, `${y}-${m}-${d}`);
    assert.deepEqual(lunarToSolar(y, 1, 1), { y, m, d });
  }
});

test('음력 추석', () => {
  for (const [y, m, d] of [[2024, 9, 17], [2025, 10, 6], [2026, 9, 25], [2023, 9, 29], [2022, 9, 10]]) {
    assert.deepEqual(solarToLunar(y, m, d), { y, m: 8, d: 15, leap: false }, `${y}-${m}-${d}`);
  }
});

test('윤달', () => {
  assert.deepEqual(solarToLunar(2023, 3, 22), { y: 2023, m: 2, d: 1, leap: true });
  assert.deepEqual(solarToLunar(2025, 7, 25), { y: 2025, m: 6, d: 1, leap: true });
  assert.deepEqual(solarToLunar(2020, 5, 23), { y: 2020, m: 4, d: 1, leap: true });
  assert.deepEqual(solarToLunar(2017, 6, 24), { y: 2017, m: 5, d: 1, leap: true });
  assert.deepEqual(solarToLunar(2014, 10, 24), { y: 2014, m: 9, d: 1, leap: true });
  assert.deepEqual(lunarToSolar(2025, 6, 1, true), { y: 2025, m: 7, d: 25 });
  assert.equal(lunarMonthsOf(2025).filter((m) => m.leap).length, 1);
  assert.equal(lunarMonthsOf(2024).filter((m) => m.leap).length, 0);
});

test('사주 — 2000-01-01 12:00 서울 남', () => {
  const s = computeSaju({ year: 2000, month: 1, day: 1, hour: 12, minute: 0, gender: 'm', longitude: 126.98 });
  assert.equal(ganziName(s.pillars.year), '己卯'); // 입춘 전 → 1999년
  assert.equal(ganziName(s.pillars.month), '丙子');
  assert.equal(ganziName(s.pillars.day), '戊午');
  assert.equal(ganziName(s.pillars.hour), '戊午'); // 戊일 午시 → 戊午
});

test('사주 — 입춘 경계 (2024-02-04 17:00 vs 18:00 KST, 서울)', () => {
  const before = computeSaju({ year: 2024, month: 2, day: 4, hour: 17, minute: 0, gender: 'f', longitude: null });
  const after = computeSaju({ year: 2024, month: 2, day: 4, hour: 18, minute: 0, gender: 'f', longitude: null });
  assert.equal(ganziName(before.pillars.year), '癸卯');
  assert.equal(ganziName(before.pillars.month), '乙丑');
  assert.equal(ganziName(after.pillars.year), '甲辰');
  assert.equal(ganziName(after.pillars.month), '丙寅');
});

test('시주 — 야자시/조자시/진태양시', () => {
  // 23:30 서울: 진태양시 보정(-32분) → 22:58 → 亥시
  const a = computeSaju({ year: 1990, month: 5, day: 5, hour: 23, minute: 30, gender: 'm', longitude: 126.98 });
  assert.equal(a.pillars.hour.branch, 11);
  // 보정 없음 → 子시(야자시), 일주 유지, 시간은 익일 일간 기준
  const b = computeSaju({ year: 1990, month: 5, day: 5, hour: 23, minute: 30, gender: 'm', longitude: null });
  assert.equal(b.pillars.hour.branch, 0);
  assert.equal(b.pillars.day.idx, a.pillars.day.idx);
  const c = computeSaju({ year: 1990, month: 5, day: 5, hour: 23, minute: 30, gender: 'm', longitude: null, zasi: 'jeongja' });
  assert.equal(c.pillars.day.idx, (a.pillars.day.idx + 1) % 60);
  assert.equal(c.pillars.hour.idx, b.pillars.hour.idx);
});

test('대운 방향과 시작 나이', () => {
  const m = computeSaju({ year: 2000, month: 1, day: 1, hour: 12, gender: 'm', longitude: null }); // 己(음)년 남 → 역행
  assert.equal(m.daeun.forward, false);
  const f = computeSaju({ year: 2000, month: 1, day: 1, hour: 12, gender: 'f', longitude: null });
  assert.equal(f.daeun.forward, true);
  assert.ok(f.daeun.startAge >= 1 && f.daeun.startAge <= 10);
  assert.equal(f.daeun.list.length, 9);
  assert.equal(ganziName(f.daeun.list[0]), '丁丑');
  assert.equal(ganziName(m.daeun.list[0]), '乙亥');
});

test('시주 미상', () => {
  const s = computeSaju({ year: 1988, month: 8, day: 8, hour: null, gender: 'f', longitude: 126.98 });
  assert.equal(s.pillars.hour, null);
  assert.equal(s.time.dst, true); // 1988 서머타임
});
