// 천문 계산 — Meeus, Astronomical Algorithms (2nd ed.) 기반.
// 태양 시황경(ch.25)으로 24절기 시각을, 삭(朔) 시각(ch.49)으로 음력 월초를 구한다.
// 모든 시각은 율리우스일(JD). TT/UT 차이(ΔT)는 근사식으로 보정한다.

import { sunApparentLongitudeVSOP } from './vsop.js';

const RAD = Math.PI / 180;

/** 그레고리력 → 율리우스일 (UT 기준, 일 단위 소수 허용). Meeus 7.1 */
export function jdFromDate(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

/** 율리우스일 → {y, m, d(소수)} 그레고리력. Meeus 7 */
export function dateFromJd(jd) {
  const Z = Math.floor(jd + 0.5);
  const F = jd + 0.5 - Z;
  let A = Z;
  if (Z >= 2299161) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const d = B - D - Math.floor(30.6001 * E) + F;
  const m = E < 14 ? E - 1 : E - 13;
  const y = m > 2 ? C - 4716 : C - 4715;
  return { y, m, d };
}

/** ΔT = TT − UT (초). Espenak & Meeus 다항 근사. */
export function deltaT(year) {
  const y = year;
  if (y < 1900) {
    const t = y - 1900;
    return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  }
  if (y < 1920) { const t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (y < 1941) { const t = y - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t ** 3; }
  if (y < 1961) { const t = y - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
  if (y < 1986) { const t = y - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
  if (y < 2005) { const t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
  if (y < 2050) { const t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u - 0.5628 * (2150 - y);
}

/** UT 율리우스일 → TT(JDE) */
export function jdToJde(jdUt) {
  const { y, m } = dateFromJd(jdUt);
  return jdUt + deltaT(y + (m - 0.5) / 12) / 86400;
}
export function jdeToJd(jde) {
  const { y, m } = dateFromJd(jde);
  return jde - deltaT(y + (m - 0.5) / 12) / 86400;
}

const norm360 = (x) => ((x % 360) + 360) % 360;

/** 태양 시황경(apparent longitude, 도). Meeus ch.25 저정밀(±0.01°). 입력은 JDE(TT). */
export function sunApparentLongitudeLow(jde) {
  const T = (jde - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * RAD;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
    + 0.000289 * Math.sin(3 * M);
  const trueLong = L0 + C;
  const omega = (125.04 - 1934.136 * T) * RAD;
  return norm360(trueLong - 0.00569 - 0.00478 * Math.sin(omega));
}

/** 태양 시황경(도). VSOP87 절단 급수(분 단위 이내 정밀). 입력은 JDE(TT). */
export const sunApparentLongitude = sunApparentLongitudeVSOP;

/**
 * 태양 황경이 target(도)이 되는 시각(JDE)을 근사 시작점 jde0 근처에서 찾는다.
 * 뉴턴식 반복. 하루 평균 이동 0.9856°.
 */
export function findSolarLongitudeTime(target, jde0) {
  let jde = jde0;
  for (let i = 0; i < 8; i++) {
    let diff = target - sunApparentLongitude(jde);
    diff = ((diff + 180) % 360 + 360) % 360 - 180;
    jde += diff / 0.98564736;
    if (Math.abs(diff) < 1e-6) break;
  }
  return jde;
}

/**
 * 24절기. index 0 = 소한(285°) … 23 = 동지(270°).
 * 황경 = (285 + 15·k) mod 360.
 */
export const SOLAR_TERM_NAMES = [
  '소한', '대한', '입춘', '우수', '경칩', '춘분', '청명', '곡우', '입하', '소만', '망종', '하지',
  '소서', '대서', '입추', '처서', '백로', '추분', '한로', '상강', '입동', '소설', '대설', '동지',
];
export const termLongitude = (k) => (285 + 15 * k) % 360;

/** 특정 연도의 k번째 절기 시각(JDE). 소한은 1월, 동지는 12월. */
export function solarTermJde(year, k) {
  // 대략적인 날짜: 소한 1/6, 이후 15.2일 간격
  const approxDay = 6 + 15.2184 * k;
  const jd0 = jdFromDate(year, 1, 1) + approxDay;
  return findSolarLongitudeTime(termLongitude(k), jdToJde(jd0));
}

/** 삭(朔, new moon) 시각(JDE). k는 2000년 1월 6일 삭을 0으로 하는 삭망월 번호. Meeus ch.49 */
export function newMoonJde(k) {
  const T = k / 1236.85;
  const T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = (2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3) * RAD;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * RAD;
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * RAD;
  const Om = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * RAD;
  const s = Math.sin;
  let corr = 0
    - 0.40720 * s(Mp)
    + 0.17241 * E * s(M)
    + 0.01608 * s(2 * Mp)
    + 0.01039 * s(2 * F)
    + 0.00739 * E * s(Mp - M)
    - 0.00514 * E * s(Mp + M)
    + 0.00208 * E * E * s(2 * M)
    - 0.00111 * s(Mp - 2 * F)
    - 0.00057 * s(Mp + 2 * F)
    + 0.00056 * E * s(2 * Mp + M)
    - 0.00042 * s(3 * Mp)
    + 0.00042 * E * s(M + 2 * F)
    + 0.00038 * E * s(M - 2 * F)
    - 0.00024 * E * s(2 * Mp - M)
    - 0.00017 * s(Om)
    - 0.00007 * s(Mp + 2 * M)
    + 0.00004 * s(2 * Mp - 2 * F)
    + 0.00004 * s(3 * M)
    + 0.00003 * s(Mp + M - 2 * F)
    + 0.00003 * s(2 * Mp + 2 * F)
    - 0.00003 * s(Mp + M + 2 * F)
    + 0.00003 * s(Mp - M + 2 * F)
    - 0.00002 * s(Mp - M - 2 * F)
    - 0.00002 * s(2 * Mp + M)
    + 0.00002 * s(4 * Mp);
  const A = [
    [299.77, 0.107408, -0.009173, 0.000325],
    [251.88, 0.016321, 0, 0.000165],
    [251.83, 26.651886, 0, 0.000164],
    [349.42, 36.412478, 0, 0.000126],
    [84.66, 18.206239, 0, 0.000110],
    [141.74, 53.303771, 0, 0.000062],
    [207.14, 2.453732, 0, 0.000060],
    [154.84, 7.306860, 0, 0.000056],
    [34.52, 27.261239, 0, 0.000047],
    [207.19, 0.121824, 0, 0.000042],
    [291.34, 1.844379, 0, 0.000040],
    [161.72, 24.198154, 0, 0.000037],
    [239.56, 25.513099, 0, 0.000035],
    [331.55, 3.592518, 0, 0.000023],
  ];
  for (const [a0, a1, a2, c] of A) corr += c * s((a0 + a1 * k + a2 * T2) * RAD);
  return jde + corr;
}

/** 주어진 JD(UT) 직전(또는 같은 시각)의 삭 번호 k */
export function newMoonIndexBefore(jdUt) {
  const { y, m, d } = dateFromJd(jdUt);
  const yearFrac = y + (m - 1 + d / 31) / 12;
  let k = Math.floor((yearFrac - 2000) * 12.3685) + 1;
  while (jdeToJd(newMoonJde(k)) > jdUt) k--;
  while (jdeToJd(newMoonJde(k + 1)) <= jdUt) k++;
  return k;
}
