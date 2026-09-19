// 만세력 — 사주 원국(년·월·일·시주), 음양력 변환, 대운.
import {
  jdFromDate, dateFromJd, jdToJde, jdeToJd, sunApparentLongitude, findSolarLongitudeTime,
  solarTermJde, newMoonJde, newMoonIndexBefore, SOLAR_TERM_NAMES,
} from './astro.js';

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const STEMS_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const BRANCHES_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
export const BRANCH_ANIMALS = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
export const ELEMENTS = ['木', '火', '土', '金', '水'];
export const ELEMENTS_KO = ['목', '화', '토', '금', '수'];
export const STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
export const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
// 지장간 (여기, 중기, 정기) — 정기가 마지막
export const HIDDEN_STEMS = [
  [8, 9], [9, 7, 5], [4, 2, 0], [0, 1], [1, 9, 4], [4, 6, 2],
  [2, 5, 3], [3, 1, 5], [4, 8, 6], [6, 7], [7, 3, 4], [4, 0, 8],
];
export const BRANCH_MAIN_STEM = HIDDEN_STEMS.map((h) => h[h.length - 1]);

export const KST_OFFSET_H = 9;

/** 한국 표준시 역사: 1954-03-21 ~ 1961-08-09 는 UTC+8:30 */
export function koreaZoneOffsetHours(y, m, d) {
  const key = y * 10000 + m * 100 + d;
  if (key >= 19540321 && key < 19610810) return 8.5;
  return 9;
}

/** 한국 일광절약시(서머타임) 적용 기간 — [시작, 끝] (끝 날짜 포함하지 않음) */
const KOREA_DST = [
  [19480601, 19480913], [19490403, 19490911], [19500401, 19500910], [19510506, 19510909],
  [19550505, 19550909], [19560520, 19560930], [19570505, 19570922], [19580504, 19580921],
  [19590503, 19590920], [19600501, 19600918], [19870510, 19871011], [19880508, 19881009],
];
export function isKoreaDst(y, m, d) {
  const key = y * 10000 + m * 100 + d;
  return KOREA_DST.some(([a, b]) => key >= a && key < b);
}

export const CITIES = [
  { id: 'seoul', name: '서울·경기', lon: 126.98 },
  { id: 'busan', name: '부산·경남', lon: 129.08 },
  { id: 'daegu', name: '대구·경북', lon: 128.60 },
  { id: 'gwangju', name: '광주·전남', lon: 126.85 },
  { id: 'daejeon', name: '대전·충청', lon: 127.38 },
  { id: 'gangwon', name: '강원', lon: 127.73 },
  { id: 'jeonju', name: '전주·전북', lon: 127.15 },
  { id: 'jeju', name: '제주', lon: 126.53 },
  { id: 'none', name: '해외/보정 안 함', lon: null },
];

const pad2 = (n) => String(n).padStart(2, '0');
export const fmtDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

/** 60갑자 인덱스 → {stem, branch} */
export const ganzi = (i) => ({ idx: ((i % 60) + 60) % 60, stem: ((i % 10) + 10) % 10, branch: ((i % 12) + 12) % 12 });
export const ganziName = (g) => `${STEMS[g.stem]}${BRANCHES[g.branch]}`;
export const ganziKo = (g) => `${STEMS_KO[g.stem]}${BRANCHES_KO[g.branch]}`;
/** stem, branch → 60갑자 인덱스 (존재하지 않는 조합이면 -1) */
export function ganziIndex(stem, branch) {
  for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i;
  return -1;
}

/** 로컬 달력 날짜의 율리우스일 번호(정수, 정오 기준) */
export const jdn = (y, m, d) => Math.floor(jdFromDate(y, m, d) + 0.5);

/** 일주 60갑자 인덱스. 1900-01-01 = 甲戌, 2000-01-01 = 戊午 */
export const dayGanziIndex = (y, m, d) => (((jdn(y, m, d) + 49) % 60) + 60) % 60;

/** 연주 (입춘 기준 아님 — 단순 연도). 1984 = 甲子 */
export const yearGanziIndex = (year) => (((year - 4) % 60) + 60) % 60;

// ── 음력 ─────────────────────────────────────────────────────────────

/** JD(UT) → KST 달력 일 (정수 JDN) */
const kstDayOfJdUt = (jdUt) => Math.floor(jdUt + KST_OFFSET_H / 24 + 0.5);

/** JDN → {y,m,d} */
export function ymdOfJdn(n) {
  const { y, m, d } = dateFromJd(n);
  return { y, m, d: Math.floor(d) };
}

/**
 * 동지(year) 를 포함하는 달로 시작하는 '세(歲)'의 월 목록.
 * 반환: [{ startJdn, endJdn(다음 달 시작), month(1~12), leap, lunarYear }]
 * 규칙: 동지를 품은 달이 11월. 동지~동지 사이에 달이 13개면 中氣가 없는 첫 달이 윤달.
 */
function buildSui(year) {
  const wsThis = jdeToJd(solarTermJde(year, 23));      // 동지 (year)
  const wsNext = jdeToJd(solarTermJde(year + 1, 23));  // 동지 (year+1)
  const kThis = newMoonIndexBefore(wsThis + 0.5 - KST_OFFSET_H / 24 + 1e-9);
  // 동지 당일 KST 기준: 삭이 동지와 같은 날이면 그 달이 11월
  let k0 = kThis;
  if (kstDayOfJdUt(jdeToJd(newMoonJde(k0 + 1))) <= kstDayOfJdUt(wsThis)) k0 += 1;
  let k1 = newMoonIndexBefore(wsNext + 0.5 - KST_OFFSET_H / 24 + 1e-9);
  if (kstDayOfJdUt(jdeToJd(newMoonJde(k1 + 1))) <= kstDayOfJdUt(wsNext)) k1 += 1;

  const starts = [];
  for (let k = k0; k <= k1; k++) starts.push(kstDayOfJdUt(jdeToJd(newMoonJde(k))));
  const count = starts.length - 1; // k0..k1-1 이 이 세의 달
  // 中氣 날짜 목록 (동지 포함, year~year+1 범위)
  const zhongqi = [];
  for (let yy = year; yy <= year + 1; yy++) {
    for (let k = 1; k < 24; k += 2) zhongqi.push(kstDayOfJdUt(jdeToJd(solarTermJde(yy, k))));
  }
  const hasZhongqi = (a, b) => zhongqi.some((z) => z >= a && z < b);

  const months = [];
  let leapDone = false;
  let num = 11; let lunarYear = year;
  for (let i = 0; i < count; i++) {
    const a = starts[i], b = starts[i + 1];
    let leap = false;
    if (count === 13 && !leapDone && i > 0 && !hasZhongqi(a, b)) { leap = true; leapDone = true; }
    if (!leap) {
      if (i > 0) { num += 1; if (num === 13) { num = 1; lunarYear += 1; } }
    }
    months.push({ startJdn: a, endJdn: b, month: num, leap, lunarYear });
  }
  return months;
}

const suiCache = new Map();
const getSui = (year) => { if (!suiCache.has(year)) suiCache.set(year, buildSui(year)); return suiCache.get(year); };

/** 양력 → 음력 {y, m, d, leap} */
export function solarToLunar(y, m, d) {
  const n = jdn(y, m, d);
  for (const sy of [y - 1, y, y - 2]) {
    for (const mo of getSui(sy)) {
      if (n >= mo.startJdn && n < mo.endJdn) return { y: mo.lunarYear, m: mo.month, d: n - mo.startJdn + 1, leap: mo.leap };
    }
  }
  throw new Error('음력 변환 실패');
}

/** 음력 → 양력 {y, m, d}. 해당 윤달/날짜가 없으면 null */
export function lunarToSolar(ly, lm, ld, leap = false) {
  for (const sy of [ly - 1, ly]) {
    for (const mo of getSui(sy)) {
      if (mo.lunarYear === ly && mo.month === lm && mo.leap === !!leap) {
        if (ld < 1 || ld > mo.endJdn - mo.startJdn) return null;
        return ymdOfJdn(mo.startJdn + ld - 1);
      }
    }
  }
  return null;
}

/** 음력 연도의 달 목록 (UI용): [{month, leap, days}] */
export function lunarMonthsOf(ly) {
  const out = [];
  for (const sy of [ly - 1, ly]) for (const mo of getSui(sy)) if (mo.lunarYear === ly) out.push({ month: mo.month, leap: mo.leap, days: mo.endJdn - mo.startJdn });
  return out;
}

// ── 사주 원국 ────────────────────────────────────────────────────────

/**
 * 사주 계산.
 * @param {object} p
 * @param {number} p.year @param {number} p.month @param {number} p.day  양력 생년월일
 * @param {number|null} p.hour @param {number} [p.minute]  시계 시각(출생지 표준시). hour가 null이면 시주 미상
 * @param {'m'|'f'} p.gender
 * @param {number|null} [p.longitude]  진태양시 보정용 경도(동경). null이면 보정 안 함
 * @param {boolean} [p.applyDst=true]  한국 서머타임 기간 자동 보정
 * @param {'yaja'|'jeongja'} [p.zasi='yaja']  23시 이후 일주 처리. yaja: 일주 유지(야자시), jeongja: 익일 일주
 */
export function computeSaju(p) {
  const { year, month, day, gender } = p;
  const hourKnown = p.hour !== null && p.hour !== undefined;
  const hour = hourKnown ? p.hour : 12;
  const minute = p.minute || 0;
  const zasi = p.zasi || 'yaja';

  // 1) 시계 시각 → UT
  let zone = koreaZoneOffsetHours(year, month, day);
  const dst = (p.applyDst !== false) && isKoreaDst(year, month, day);
  if (p.longitude === null || p.longitude === undefined) { /* 해외: 보정 없음, 표준시 그대로 */ }
  const clockHours = hour + minute / 60 - (dst ? 1 : 0);
  const jdUt = jdFromDate(year, month, day) + (clockHours - zone) / 24;
  const jde = jdToJde(jdUt);

  // 2) 진태양시(경도 보정) — 시주 결정용 로컬 시각
  let localHours = clockHours; // 표준시 기준 (DST 제거 후)
  let solarCorrectionMin = 0;
  if (p.longitude !== null && p.longitude !== undefined) {
    solarCorrectionMin = Math.round((p.longitude / 15 - zone) * 60);
    localHours = clockHours + solarCorrectionMin / 60;
  }
  // 로컬(진태양) 날짜/시각 정규화
  let dJdn = jdn(year, month, day);
  let lh = localHours;
  if (lh < 0) { lh += 24; dJdn -= 1; }
  if (lh >= 24) { lh -= 24; dJdn += 1; }

  // 3) 태양 황경 → 월지/연주
  const lon = sunApparentLongitude(jde);
  const monthIdx = Math.floor((((lon - 315) % 360) + 360) % 360 / 30); // 0 = 寅월
  const monthBranch = (monthIdx + 2) % 12;
  let sajuYear = year;
  if (month <= 2 && lon >= 240 && lon < 315) sajuYear = year - 1;
  if (month === 12 && lon >= 315) sajuYear = year + 1; // 이론상 발생하지 않음
  const yearG = ganzi(yearGanziIndex(sajuYear));
  const monthStem = ((yearG.stem % 5) * 2 + 2 + monthIdx) % 10;
  const monthG = ganzi(ganziIndex(monthStem, monthBranch));

  // 4) 일주 / 시주
  const hourBranch = hourKnown ? Math.floor(((lh * 60 + 60) % 1440) / 120) : null;
  let dayJdnForPillar = dJdn;
  const isLateZi = hourKnown && lh >= 23;
  if (isLateZi && zasi === 'jeongja') dayJdnForPillar = dJdn + 1;
  const dayIdx = (((dayJdnForPillar + 49) % 60) + 60) % 60;
  const dayG = ganzi(dayIdx);
  let hourG = null;
  if (hourKnown) {
    // 야자시(23시대)는 익일 일간 기준으로 시간 산출
    const stemBase = (isLateZi && zasi === 'yaja') ? ganzi(dayIdx + 1).stem : dayG.stem;
    const hourStem = ((stemBase % 5) * 2 + hourBranch) % 10;
    hourG = ganzi(ganziIndex(hourStem, hourBranch));
  }

  // 5) 대운
  const yangYear = yearG.stem % 2 === 0;
  const forward = (yangYear && gender === 'm') || (!yangYear && gender === 'f');
  // 현재 월의 절(節) 시작과 다음 절
  const curTermLon = (315 + monthIdx * 30) % 360;
  const nextTermLon = (curTermLon + 30) % 360;
  const prevTermJde = findSolarLongitudeTime(curTermLon, jde - 15);
  const nextTermJde = findSolarLongitudeTime(nextTermLon, jde + 15);
  const daysToNext = nextTermJde - jde;
  const daysFromPrev = jde - prevTermJde;
  const daeunDays = forward ? daysToNext : daysFromPrev;
  let daeunStart = Math.round(daeunDays / 3);
  if (daeunStart < 1) daeunStart = 1; if (daeunStart > 10) daeunStart = 10;
  const daeun = [];
  for (let i = 1; i <= 9; i++) {
    const g = ganzi(monthG.idx + (forward ? i : -i));
    daeun.push({ ...g, fromAge: daeunStart + (i - 1) * 10, toAge: daeunStart + i * 10 - 1 });
  }

  // 6) 절기 정보
  const termNameIdx = (monthIdx * 2 + 2) % 24; // 寅월 → 입춘(2)
  const prevJd = jdeToJd(prevTermJde), nextJd = jdeToJd(nextTermJde);

  // 7) 음력
  const lunar = solarToLunar(year, month, day);

  // 공망 (일주 기준)
  const xunStart = dayIdx - (dayIdx % 10);
  const gongmang = [(xunStart + 10) % 12, (xunStart + 11) % 12];

  return {
    input: { ...p, hourKnown },
    solar: { y: year, m: month, d: day },
    lunar,
    time: {
      zone, dst, solarCorrectionMin, localHours: lh, trueSolarDateJdn: dJdn,
      sunLongitude: lon,
    },
    pillars: { year: yearG, month: monthG, day: dayG, hour: hourG },
    sajuYear,
    monthIdx,
    term: {
      name: SOLAR_TERM_NAMES[termNameIdx],
      next: SOLAR_TERM_NAMES[(termNameIdx + 2) % 24],
      prevAt: kstStamp(prevJd), nextAt: kstStamp(nextJd),
      daysFromPrev: +daysFromPrev.toFixed(2), daysToNext: +daysToNext.toFixed(2),
    },
    daeun: { forward, startAge: daeunStart, list: daeun },
    gongmang,
  };
}

function kstStamp(jdUt) {
  const { y, m, d } = dateFromJd(jdUt + KST_OFFSET_H / 24);
  const day = Math.floor(d); const h = (d - day) * 24; const hh = Math.floor(h); const mm = Math.floor((h - hh) * 60);
  return `${y}-${pad2(m)}-${pad2(day)} ${pad2(hh)}:${pad2(mm)}`;
}

/** 특정 연도의 세운(연주) */
export const yearPillar = (year) => ganzi(yearGanziIndex(year));
/** 특정 양력 월의 월운: 그 달 15일 기준 월주 */
export function monthPillarAt(year, month) {
  const jde = jdToJde(jdFromDate(year, month, 15));
  const lon = sunApparentLongitude(jde);
  const monthIdx = Math.floor((((lon - 315) % 360) + 360) % 360 / 30);
  let sy = year; if (month <= 2 && lon >= 240 && lon < 315) sy = year - 1;
  const ys = ganzi(yearGanziIndex(sy)).stem;
  return ganzi(ganziIndex(((ys % 5) * 2 + 2 + monthIdx) % 10, (monthIdx + 2) % 12));
}
