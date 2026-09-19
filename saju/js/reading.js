// 해석 엔진 — 사주 원국에서 구조화된 분석(analyze)을 만들고, 묘선생 말투의 풀이(compose)를 생성한다.
import {
  STEMS, STEMS_KO, BRANCHES, BRANCHES_KO, BRANCH_ANIMALS, ELEMENTS, ELEMENTS_KO,
  STEM_ELEMENT, BRANCH_ELEMENT, HIDDEN_STEMS, BRANCH_MAIN_STEM, ganziName, ganziKo, yearPillar,
} from './manse.js';

// ── 십신 ─────────────────────────────────────────────────────────────
export const SIPSIN = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
const SIPSIN_GROUP = ['비겁', '비겁', '식상', '식상', '재성', '재성', '관성', '관성', '인성', '인성'];

/** 일간(dayStem) 기준 다른 천간(stem)의 십신 인덱스 */
export function sipsinOf(dayStem, stem) {
  const de = STEM_ELEMENT[dayStem], se = STEM_ELEMENT[stem];
  const same = (dayStem % 2) === (stem % 2);
  const rel = (se - de + 5) % 5; // 0 같음, 1 내가 생함, 2 내가 극함, 3 나를 극함, 4 나를 생함
  return rel * 2 + (same ? 0 : 1);
}

const ELEMENT_INFO = [
  { ko: '목', hanja: '木', color: '초록·청색', dir: '동쪽', season: '봄', keyword: '성장·시작·의지', organ: '간·눈·근육', taste: '신맛' },
  { ko: '화', hanja: '火', color: '빨강·주황', dir: '남쪽', season: '여름', keyword: '열정·표현·확산', organ: '심장·혈관', taste: '쓴맛' },
  { ko: '토', hanja: '土', color: '노랑·베이지', dir: '중앙', season: '환절기', keyword: '신뢰·중재·안정', organ: '위·소화기', taste: '단맛' },
  { ko: '금', hanja: '金', color: '흰색·은색', dir: '서쪽', season: '가을', keyword: '결단·원칙·정리', organ: '폐·피부', taste: '매운맛' },
  { ko: '수', hanja: '水', color: '검정·남색', dir: '북쪽', season: '겨울', keyword: '지혜·유연·저장', organ: '신장·방광', taste: '짠맛' },
];

// 일간 10종 성격 — 묘선생 말투
const DAY_MASTER = [
  { name: '갑목(甲木)', image: '곧게 뻗은 큰 나무', text: '갑목은 하늘로 곧게 자라는 큰 나무예요. 앞에 나서서 이끄는 걸 좋아하고, 한번 정한 방향은 잘 안 굽혀요. 정직하고 인정이 많은데, 그만큼 고집도 세서 굽히는 법을 배우면 훨씬 편해지는 사주예요. 남 밑에서 오래 있기보다 스스로 판을 짜는 쪽이 어울려요.' },
  { name: '을목(乙木)', image: '바람에 휘는 풀과 꽃', text: '을목은 담쟁이나 들꽃 같아요. 부드럽고 유연해서 어디서든 살아남는 힘이 있죠. 겉으론 온순해 보여도 속은 끈질겨요. 사람 관계에서 눈치가 빠르고 조율을 잘하는 대신, 혼자 결단할 땐 조금 망설이는 편이에요. 기댈 나무(귀인)를 잘 만나면 크게 피어요.' },
  { name: '병화(丙火)', image: '한낮의 태양', text: '병화는 해예요. 밝고 화끈하고, 어디 가든 눈에 띄죠. 숨기는 게 없어서 사람들이 편하게 다가와요. 다만 해는 골고루 비추다 보니 한 사람에게 깊이 집중하는 건 서툴 수 있고, 감정이 얼굴에 다 드러나요. 큰 무대, 많은 사람 앞에서 힘이 나는 사주예요.' },
  { name: '정화(丁火)', image: '촛불·등불', text: '정화는 촛불이에요. 태양처럼 요란하진 않지만 어둠 속에서 꼭 필요한 빛이죠. 섬세하고 배려심이 깊고, 속으로 오래 생각해요. 따뜻한데 예민해서 상처도 잘 받아요. 한 분야를 깊게 파거나, 사람을 돌보고 가르치는 일에서 빛나요.' },
  { name: '무토(戊土)', image: '큰 산·너른 들', text: '무토는 큰 산이에요. 묵직하고 믿음직해서 사람들이 기대러 와요. 웬만한 일엔 흔들리지 않는 대신, 움직이기 시작하는 데 시간이 걸리죠. 중심을 잡아주는 역할, 사람을 모으고 지키는 역할에 잘 맞아요. 고집이 산만 해서 남 말을 한 번 더 들어주면 좋아요.' },
  { name: '기토(己土)', image: '기름진 논밭', text: '기토는 논밭이에요. 무엇이든 심으면 키워내는 땅이라 실속 있고 현실적이죠. 겉으론 순해 보여도 속으로는 계산이 서 있어요. 꼼꼼하고 잘 챙기는 사람이라 주변에서 의지를 많이 해요. 다만 걱정을 속에 쌓아두는 버릇이 있어서 털어놓는 연습이 필요해요.' },
  { name: '경금(庚金)', image: '원석·무쇠', text: '경금은 무쇠예요. 단단하고 의리 있고, 옳다고 생각하면 밀어붙여요. 말이 직설적이라 오해를 사기도 하지만, 뒤끝은 없죠. 불(火)로 담금질을 받아야 명검이 되듯, 시련을 겪을수록 단단해지는 사주예요. 결단이 필요한 자리에서 진가가 나와요.' },
  { name: '신금(辛金)', image: '보석·잘 벼린 칼', text: '신금은 보석이에요. 예민하고 섬세하고, 자기만의 미의식이 뚜렷하죠. 깔끔한 걸 좋아하고 대충을 못 견뎌요. 겉은 차분한데 속엔 자존심이 단단히 서 있어요. 남이 알아봐 줄 때 빛나는 사주라, 실력을 갈고닦아 보여줄 무대를 찾는 게 중요해요.' },
  { name: '임수(壬水)', image: '큰 강·바다', text: '임수는 큰 강이에요. 생각이 넓고 깊고, 포용력이 커요. 어디로든 흘러가는 물이라 자유를 좋아하고, 한곳에 묶이면 답답해해요. 머리 회전이 빠르고 큰 그림을 잘 그리죠. 대신 물이 너무 많아지면 방향을 잃기 쉬우니, 목표라는 둑을 세워두면 좋아요.' },
  { name: '계수(癸水)', image: '빗물·이슬·안개', text: '계수는 비와 이슬이에요. 조용히 스며들어 만물을 적시죠. 감수성이 풍부하고 직관이 날카로워요. 겉으론 조용한데 속으로는 많은 걸 느끼고 기억해요. 눈치와 적응력이 좋아서 어떤 환경에도 스며들지만, 마음을 다 보여주진 않아요. 글·예술·상담·연구처럼 깊이 있는 일이 잘 맞아요.' },
];

const SIPSIN_TEXT = {
  비겁: { strong: '비견·겁재가 많아요. 내 편, 내 힘이 많다는 뜻이라 독립심이 강하고 남에게 기대지 않아요. 친구도 많고요. 대신 돈이 들어와도 사람 때문에 나가는 일이 생기고, 경쟁 상황에 자주 놓여요. 동업보다는 내 몫이 확실한 구조가 좋아요.', weak: '비견·겁재가 거의 없어요. 혼자 다 짊어지려는 버릇이 생기기 쉬워요. 형제나 친구 같은 "내 편"을 의식적으로 만들어두면 살면서 든든해요.' },
  식상: { strong: '식신·상관이 두드러져요. 표현력, 재주, 먹고사는 재능이 여기서 나와요. 말이나 손으로 무언가를 만들어내는 힘이 있고, 자유로운 걸 좋아하죠. 틀에 박힌 조직은 답답해할 수 있어요. 재능을 돈으로 바꾸는 길(식상생재)이 열려 있는 사주예요.', weak: '식상이 약해요. 속에 있는 걸 밖으로 꺼내는 게 서툴러서 답답할 때가 있죠. 글쓰기, 말하기, 취미처럼 "표현하는 통로"를 하나 만들어두면 운이 풀려요.' },
  재성: { strong: '재성이 많아요. 현실 감각이 좋고 돈의 흐름을 읽어요. 사람 관계도 넓고, 이성에게도 인기가 있는 편이죠. 다만 재성이 너무 많으면 내 몸이 지치기 쉬워요(재다신약). 욕심보다 체력 관리, 한 번에 하나씩이 답이에요.', weak: '재성이 약해요. 돈에 크게 욕심이 없거나, 벌어도 관리에 서툴 수 있어요. 대신 돈보다 명예·공부·사람에 가치를 두죠. 재물운은 대운·세운에서 재성이 들어올 때 열리니 그 시기를 기억해두세요.' },
  관성: { strong: '관성이 강해요. 책임감, 규율, 명예를 중시해요. 조직에서 인정받고 직책을 맡는 힘이 있죠. 다만 관이 너무 강하면 스스로를 옥죄고 스트레스가 몸으로 와요. "남 눈치"보다 "내 기준"을 세우는 연습이 필요해요.', weak: '관성이 약해요. 규칙에 얽매이는 걸 싫어하고 자유롭게 살고 싶어 하죠. 조직보다 프리랜서나 자기 사업이 맞을 수 있어요. 대신 스스로 정한 루틴이 없으면 흐트러지기 쉬우니 작은 규칙을 만들어두세요.' },
  인성: { strong: '인성이 많아요. 배우는 걸 좋아하고 생각이 깊어요. 어른 덕, 문서 덕(자격·학위·계약)이 있는 사주죠. 다만 인성이 너무 많으면 생각만 하고 실행이 늦어지고, 남이 해주기를 기다리는 마음이 생겨요. 생각 반, 행동 반이 답이에요.', weak: '인성이 약해요. 누가 가르쳐주기보다 부딪치며 배우는 타입이에요. 자기 힘으로 일군 것에 자부심이 크죠. 대신 마음이 지칠 때 기댈 곳이 부족할 수 있으니 공부나 신앙, 멘토처럼 "채워주는 것"을 하나 두세요.' },
};

const BRANCH_CHUNG = (a, b) => (a + 6) % 12 === b;
const YUKHAP = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
const SAMHAP = [
  { set: [8, 0, 4], el: 4, name: '신자진(申子辰) 수국' },
  { set: [2, 6, 10], el: 1, name: '인오술(寅午戌) 화국' },
  { set: [11, 3, 7], el: 0, name: '해묘미(亥卯未) 목국' },
  { set: [5, 9, 1], el: 3, name: '사유축(巳酉丑) 금국' },
];
const POS_KO = { year: '연주', month: '월주', day: '일주', hour: '시주' };
const POS_MEANING = { year: '조상·어린 시절', month: '부모·사회', day: '나와 배우자', hour: '자식·말년' };


// ── 조사 처리 ─────────────────────────────────────────────────────────
const hasBatchim = (word) => {
  const m = String(word).match(/[가-힣](?![가-힣])/g); // 마지막 한글 글자 (괄호 등 뒤에 붙은 비한글 무시)
  if (!m) return false;
  const code = m[m.length - 1].charCodeAt(0) - 0xac00;
  return code % 28 !== 0;
};
/** josa('목(木)', '을/를') → '목(木)을' */
export const josa = (word, pair) => {
  const [a, b] = pair.split('/');
  return word + (hasBatchim(word) ? a : b);
};
const eyo = (word) => josa(word, '이에요/예요');

// ── 분석 ─────────────────────────────────────────────────────────────
export function analyze(saju, opts = {}) {
  const now = opts.now || new Date();
  const P = saju.pillars;
  const dayStem = P.day.stem;
  const positions = ['year', 'month', 'day', 'hour'].filter((k) => P[k]);

  // 글자별 십신 / 오행
  const chars = [];
  for (const pos of positions) {
    const g = P[pos];
    chars.push({ pos, kind: 'stem', idx: g.stem, ch: STEMS[g.stem], ko: STEMS_KO[g.stem], el: STEM_ELEMENT[g.stem], yin: g.stem % 2 === 1,
      sipsin: pos === 'day' ? null : sipsinOf(dayStem, g.stem) });
    chars.push({ pos, kind: 'branch', idx: g.branch, ch: BRANCHES[g.branch], ko: BRANCHES_KO[g.branch], el: BRANCH_ELEMENT[g.branch], yin: g.branch % 2 === 1,
      sipsin: sipsinOf(dayStem, BRANCH_MAIN_STEM[g.branch]), hidden: HIDDEN_STEMS[g.branch] });
  }

  // 오행 개수 (8자 기준) + 지장간 가중
  const elementCount = [0, 0, 0, 0, 0];
  const elementWeight = [0, 0, 0, 0, 0];
  for (const c of chars) {
    elementCount[c.el] += 1;
    if (c.kind === 'stem') elementWeight[c.el] += 1;
    else {
      const hs = c.hidden; const w = hs.length === 2 ? [0.3, 0.7] : [0.2, 0.2, 0.6];
      hs.forEach((s, i) => { elementWeight[STEM_ELEMENT[s]] += w[i] * 1.2; });
    }
  }
  const missing = ELEMENTS.map((_, i) => i).filter((i) => elementCount[i] === 0);
  const sortedEl = [0, 1, 2, 3, 4].sort((a, b) => elementWeight[b] - elementWeight[a]);

  // 십신 분포 (일간 제외 7자)
  const sipsinCount = Array(10).fill(0);
  const groupCount = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const c of chars) if (c.sipsin !== null) { sipsinCount[c.sipsin] += 1; groupCount[SIPSIN_GROUP[c.sipsin]] += 1; }
  const groupsSorted = Object.entries(groupCount).sort((a, b) => b[1] - a[1]);

  // 신강약 (간이 억부): 월지 3, 일지 2, 시지 1.5, 연지 1, 천간 각 1
  const de = STEM_ELEMENT[dayStem];
  const support = (el) => el === de || (el + 1) % 5 === de; // 같은 오행, 나를 생하는 오행
  let sup = 0, total = 0;
  const weightOf = (c) => c.kind === 'stem' ? 1 : ({ month: 3, day: 2, hour: 1.5, year: 1 })[c.pos];
  for (const c of chars) { if (c.pos === 'day' && c.kind === 'stem') continue; const w = weightOf(c); total += w; if (support(c.el)) sup += w; }
  const ratio = sup / total;
  const strength = ratio >= 0.6 ? '신강' : ratio <= 0.4 ? '신약' : '중화';
  const deukryeong = support(BRANCH_ELEMENT[P.month.branch]);

  // 용신 (간이)
  let yongsin;
  if (strength === '신강') {
    const cands = [(de + 3) % 5, (de + 2) % 5, (de + 1) % 5]; // 관, 재, 식상
    yongsin = cands.sort((a, b) => elementWeight[a] - elementWeight[b])[0];
  } else if (strength === '신약') {
    const in_ = (de + 4) % 5;
    yongsin = (elementWeight[in_] >= 2.5 && elementWeight[de] < 1) ? de : in_;
  } else {
    yongsin = missing.length ? missing[0] : sortedEl[4];
  }

  // 합충
  const relations = [];
  const branchList = positions.map((pos) => ({ pos, b: P[pos].branch }));
  const stemList = positions.map((pos) => ({ pos, s: P[pos].stem }));
  for (let i = 0; i < branchList.length; i++) for (let j = i + 1; j < branchList.length; j++) {
    const A = branchList[i], B = branchList[j];
    if (BRANCH_CHUNG(A.b, B.b)) relations.push({ type: '충', label: `${BRANCHES_KO[A.b]}${BRANCHES_KO[B.b]}충(${BRANCHES[A.b]}${BRANCHES[B.b]}沖)`, pos: [A.pos, B.pos] });
    if (YUKHAP.some(([x, y]) => (x === A.b && y === B.b) || (x === B.b && y === A.b))) relations.push({ type: '육합', label: `${BRANCHES_KO[A.b]}${BRANCHES_KO[B.b]}합(${BRANCHES[A.b]}${BRANCHES[B.b]}合)`, pos: [A.pos, B.pos] });
  }
  for (const sh of SAMHAP) {
    const have = sh.set.filter((b) => branchList.some((x) => x.b === b));
    if (have.length === 3) relations.push({ type: '삼합', label: sh.name, el: sh.el });
    else if (have.length === 2 && have.includes(sh.set[1])) relations.push({ type: '반합', label: sh.name.replace('국', ' 반합'), el: sh.el });
  }
  for (let i = 0; i < stemList.length; i++) for (let j = i + 1; j < stemList.length; j++) {
    const A = stemList[i], B = stemList[j];
    if ((A.s + 5) % 10 === B.s) relations.push({ type: '천간합', label: `${STEMS_KO[Math.min(A.s, B.s)]}${STEMS_KO[Math.max(A.s, B.s)]}합(${STEMS[Math.min(A.s, B.s)]}${STEMS[Math.max(A.s, B.s)]}合)`, pos: [A.pos, B.pos] });
    if (Math.abs(A.s - B.s) === 6 && Math.min(A.s, B.s) <= 3) relations.push({ type: '천간충', label: `${STEMS_KO[Math.min(A.s, B.s)]}${STEMS_KO[Math.max(A.s, B.s)]}충`, pos: [A.pos, B.pos] });
  }

  // 나이·대운·세운
  const thisYear = now.getFullYear();
  const age = thisYear - saju.solar.y + 1; // 세는나이
  const currentDaeun = saju.daeun.list.find((d) => age >= d.fromAge && age <= d.toAge) || null;
  const nextDaeun = saju.daeun.list.find((d) => d.fromAge > age) || null;
  const yp = yearPillar(thisYear);
  const seun = {
    year: thisYear, pillar: yp, name: ganziName(yp), ko: ganziKo(yp),
    stemSipsin: sipsinOf(dayStem, yp.stem), branchSipsin: sipsinOf(dayStem, BRANCH_MAIN_STEM[yp.branch]),
    chungWithDay: BRANCH_CHUNG(yp.branch, P.day.branch), chungWithYear: BRANCH_CHUNG(yp.branch, P.year.branch),
    hapWithDay: YUKHAP.some(([x, y]) => (x === yp.branch && y === P.day.branch) || (y === yp.branch && x === P.day.branch)),
    isYongsin: STEM_ELEMENT[yp.stem] === yongsin || BRANCH_ELEMENT[yp.branch] === yongsin,
  };
  const daeunInfo = currentDaeun ? {
    ...currentDaeun, name: ganziName(currentDaeun), ko: ganziKo(currentDaeun),
    stemSipsin: sipsinOf(dayStem, currentDaeun.stem), branchSipsin: sipsinOf(dayStem, BRANCH_MAIN_STEM[currentDaeun.branch]),
    isYongsin: STEM_ELEMENT[currentDaeun.stem] === yongsin || BRANCH_ELEMENT[currentDaeun.branch] === yongsin,
  } : null;

  return {
    dayStem, dayMaster: DAY_MASTER[dayStem], chars, positions,
    elementCount, elementWeight, missing, strongestEl: sortedEl[0], weakestEl: sortedEl[4],
    sipsinCount, groupCount, groupsSorted, strength, strengthRatio: +ratio.toFixed(2), deukryeong,
    yongsin, yongsinInfo: ELEMENT_INFO[yongsin], relations,
    age, currentDaeun: daeunInfo, nextDaeun, seun,
    animal: BRANCH_ANIMALS[P.year.branch],
    calendarAnimal: BRANCH_ANIMALS[((saju.solar.y - 4) % 12 + 12) % 12],
  };
}

// ── 풀이 문장 ─────────────────────────────────────────────────────────
const el = (i) => `${ELEMENTS_KO[i]}(${ELEMENTS[i]})`;
const pick = (arr, seed) => arr[seed % arr.length];

export function compose(saju, a, opts = {}) {
  const name = (opts.name || '').trim();
  const you = name ? `${name} 님` : '손님';
  const P = saju.pillars;
  const sections = [];
  const seed = P.day.idx;

  // 1. 인사
  const lunar = saju.lunar;
  const birth = `${saju.solar.y}년 ${saju.solar.m}월 ${saju.solar.d}일` + (saju.input.hourKnown ? ` ${String(saju.input.hour).padStart(2, '0')}:${String(saju.input.minute || 0).padStart(2, '0')}` : ' (시간 미상)');
  const lunarTxt = `음력 ${lunar.y}년 ${lunar.leap ? '윤' : ''}${lunar.m}월 ${lunar.d}일`;
  let intro = `${pick(['어서 오세요.', '오셨군요.', '기다리고 있었어요.'], seed)} 묘운당 주인 묘선생이에요. (안경을 고쳐 쓰며) ${you}은 양력 ${birth}, ${lunarTxt}에 태어나셨네요. `;
  intro += `절기로는 ${saju.term.name} 지나 ${a.chars.find((c) => c.pos === 'month' && c.kind === 'branch').ko}월, ${a.animal}띠예요.`;
  if (a.animal !== a.calendarAnimal) intro += ` 달력으로는 ${a.calendarAnimal}띠지만, 사주는 입춘을 기준으로 해를 나누기 때문에 ${a.animal}띠로 봐요.`;
  if (saju.time.solarCorrectionMin) intro += ` 태어난 곳 경도에 맞춰 시각을 ${Math.abs(saju.time.solarCorrectionMin)}분 ${saju.time.solarCorrectionMin < 0 ? '당겨서' : '늦춰서'} 봤어요.`;
  if (saju.time.dst) intro += ` 그 해엔 서머타임이 있어서 한 시간을 빼고 계산했고요.`;
  sections.push({ id: 'intro', title: '첫인사', expression: 'happy', paragraphs: [intro] });

  // 2. 일간
  const dm = a.dayMaster;
  const dayBranchSipsin = SIPSIN[a.chars.find((c) => c.pos === 'day' && c.kind === 'branch').sipsin];
  sections.push({
    id: 'daymaster', title: `나를 나타내는 글자 — ${dm.name}`, expression: 'normal',
    paragraphs: [
      `사주에서 "나"는 태어난 날의 천간, 일간이에요. ${you}의 일간은 ${dm.name}, 그러니까 ${eyo(dm.image)}.`,
      dm.text,
      `일간 바로 아래 글자(일지)는 배우자 자리이자 내 속마음이에요. ${you}의 일지엔 ${dayBranchSipsin}이 앉아 있어요. ${dayBranchSipsin.endsWith('재') ? '배우자 복이 있고 현실 감각이 있는 자리예요.' : dayBranchSipsin.endsWith('관') ? '반듯하고 책임감 있는 사람을 곁에 두게 되는 자리예요.' : dayBranchSipsin.endsWith('인') ? '든든하게 받쳐주는 사람을 만나는 자리고, 속이 깊어요.' : dayBranchSipsin.startsWith('식') || dayBranchSipsin.startsWith('상') ? '표현이 자유롭고 정이 많은 자리예요. 다만 상대에게 잔소리가 될 수 있으니 조심.' : '내 고집이 강한 자리라, 배우자와는 서로 영역을 인정해줘야 편해요.'}`,
    ],
  });

  // 3. 오행
  const ec = a.elementCount;
  const elLine = ELEMENTS.map((_, i) => `${ELEMENTS_KO[i]} ${ec[i]}`).join(' · ');
  const paras = [`여덟 글자를 오행으로 나누면 ${elLine}이에요. (수염을 쓰다듬으며) 제일 힘이 센 건 ${el(a.strongestEl)}, 제일 약한 건 ${el(a.weakestEl)}이고요.`];
  const si = ELEMENT_INFO[a.strongestEl];
  paras.push(`${josa(el(a.strongestEl), '이/가')} 강하면 ${si.keyword}의 기운이 삶을 끌고 가요. 이 힘을 쓰는 방향으로 살면 잘 풀리고, 억지로 누르면 답답해져요.`);
  if (a.missing.length) {
    const m = a.missing.map(el).join(', ');
    paras.push(`${josa(m, '은/는')} 원국에 아예 없어요. 없는 오행은 살면서 자꾸 부족함을 느끼고, 그래서 더 끌리는 영역이 돼요. ${a.missing.map((i) => ELEMENT_INFO[i].keyword).join(', ')} 쪽이 그렇죠. 없다고 나쁜 게 아니라, 대운이나 세운에서 그 글자가 들어올 때 큰 변화가 온다는 신호예요.`);
  } else {
    paras.push('다섯 오행이 다 들어 있어요. 어느 한쪽으로 크게 치우치지 않아서, 상황에 따라 여러 얼굴을 낼 수 있는 사주예요.');
  }
  sections.push({ id: 'elements', title: '오행의 균형', expression: 'think', paragraphs: paras });

  // 4. 십신
  const [g1, n1] = a.groupsSorted[0];
  const [g5, n5] = a.groupsSorted[a.groupsSorted.length - 1];
  const sp = [`사주의 글자들은 나(일간)와의 관계에 따라 열 가지 이름이 붙어요. 이걸 십신이라고 하죠. ${you}의 사주에선 ${g1}이 ${n1}개로 가장 많고, ${g5}이 ${n5 === 0 ? '없어요' : `${n5}개로 가장 적어요`}.`];
  sp.push(SIPSIN_TEXT[g1].strong);
  if (n5 === 0 || n5 <= 1 && g5 !== g1) sp.push(SIPSIN_TEXT[g5].weak);
  sections.push({ id: 'sipsin', title: '십신으로 본 성향', expression: 'normal', paragraphs: sp });

  // 5. 신강약·용신
  const yi = a.yongsinInfo;
  const st = [];
  if (a.strength === '신강') st.push(`일간의 힘을 재보면 ${you}은 신강, 그러니까 내 힘이 센 사주예요. 태어난 달(월지)이 ${a.deukryeong ? '나를 도와주는 계절이고' : '내 계절은 아니지만 주변 글자들이 받쳐줘서'} 스스로 서는 힘이 있어요. 이런 사주는 힘을 밖으로 써야 해요. 가만히 있으면 그 힘이 안으로 향해 고집과 조급함이 되거든요.`);
  else if (a.strength === '신약') st.push(`일간의 힘을 재보면 ${you}은 신약, 내 힘보다 주변 기운이 큰 사주예요. 겁먹을 것 없어요. 신약은 주변을 잘 활용하는 사람이라는 뜻이니까요. 다만 무리하면 몸과 마음이 먼저 지치니, 혼자 다 하려 하지 말고 도와주는 기운을 가까이 두는 게 핵심이에요.`);
  else st.push(`일간의 힘을 재보면 ${you}은 중화에 가까워요. 내 힘과 주변 기운이 얼추 균형을 이루고 있다는 뜻이라, 비교적 무난하게 흐름을 타는 사주예요.`);
  st.push(`그래서 ${you}에게 약이 되는 기운, 용신은 ${eyo(el(a.yongsin))}. ${yi.keyword}의 기운이죠. 생활에서는 ${yi.color} 계열 색, ${yi.dir} 방향, ${yi.season}에 힘을 얻어요. 큰 결정은 ${yi.season}에, 방 배치나 자리는 ${yi.dir}을 등지거나 바라보게 두면 좋고요. (꼬리를 살랑) 미신처럼 들리겠지만, 나한테 부족한 기운을 자꾸 눈에 두라는 뜻이에요.`);
  sections.push({ id: 'strength', title: '힘의 균형과 용신', expression: 'think', paragraphs: st });

  // 6. 합충
  if (a.relations.length) {
    const rp = ['글자끼리 서로 당기고 부딪치는 관계도 봐야 해요. 합은 묶이는 것, 충은 부딪쳐 움직이는 거예요.'];
    for (const r of a.relations) {
      if (r.type === '충') rp.push(`${r.label}: ${POS_KO[r.pos[0]]}(${POS_MEANING[r.pos[0]]})와 ${POS_KO[r.pos[1]]}(${POS_MEANING[r.pos[1]]})가 부딪쳐요. 이 두 영역 사이에서 이동·변화·이별 같은 움직임이 자주 생겨요. 나쁘게만 볼 건 아니에요. 충이 있는 사람은 정체되지 않고, 변화를 스스로 만들어내거든요.`);
      else if (r.type === '육합') rp.push(`${r.label}: ${POS_KO[r.pos[0]]}와 ${POS_KO[r.pos[1]]}가 손을 잡고 있어요. ${POS_MEANING[r.pos[0]]}와 ${POS_MEANING[r.pos[1]]}가 서로 도와주는 구조라 인연이 끈끈해요.`);
      else if (r.type === '삼합' || r.type === '반합') rp.push(`${r.label}: 지지가 모여 ${el(r.el)} 기운을 크게 만들어요. 원래 글자보다 ${el(r.el)}의 힘이 실제로는 더 크게 작용한다고 보면 돼요.`);
      else if (r.type === '천간합') rp.push(`${r.label}: 천간이 묶여 있어요. 묶인 글자는 제 역할을 조금 놓게 되니, 그 자리(${POS_KO[r.pos[0]]}·${POS_KO[r.pos[1]]})의 기운은 부드럽게 쓰인다고 보세요.`);
      else if (r.type === '천간충') rp.push(`${r.label}: 천간끼리 부딪쳐요. 생각과 결정이 오락가락하기 쉬운 구조라, 큰 결정은 하루 자고 나서 하는 습관이 좋아요.`);
    }
    sections.push({ id: 'relations', title: '합과 충', expression: 'normal', paragraphs: rp });
  }

  // 7. 올해
  const s = a.seun;
  const ss = SIPSIN[s.stemSipsin], sb = SIPSIN[s.branchSipsin];
  const yp = [`올해 ${s.year}년은 ${s.ko}(${s.name})년이에요. ${you}에게는 하늘에서 ${ss}, 땅에서 ${sb}의 기운이 들어오는 해죠.`];
  yp.push(seunText(ss, sb, s, a, you));
  if (s.chungWithDay) yp.push('올해 지지가 일지와 충을 해요. 나와 배우자 자리, 내 속마음이 흔들리는 해라 이사·이직·관계 변화가 생기기 쉬워요. 변화 자체는 막을 수 없으니, 준비된 변화로 만드는 게 답이에요.');
  if (s.hapWithDay) yp.push('올해 지지가 일지와 합을 해요. 인연이 붙는 해예요. 사람을 만나거나 묶이는 일(계약, 결혼, 동업)이 생기기 좋아요.');
  if (s.chungWithYear) yp.push('연지와도 충이 있어요. 집안 어른, 고향, 오래된 것과 관련된 변화가 있을 수 있어요.');
  sections.push({ id: 'year', title: `${s.year}년의 흐름`, expression: 'think', paragraphs: yp });

  // 8. 대운
  const dp = [];
  const d = a.currentDaeun;
  dp.push(`대운은 십 년 단위로 바뀌는 큰 계절이에요. ${you}은 ${saju.daeun.startAge}세부터 ${saju.daeun.forward ? '순행' : '역행'}으로 대운이 흘러요.`);
  if (d) {
    dp.push(`지금은 ${d.fromAge}세부터 ${d.toAge}세까지 ${d.ko}(${d.name}) 대운이에요. ${josa(SIPSIN[d.stemSipsin], '과/와')} ${SIPSIN[d.branchSipsin]}의 계절이죠. ${daeunText(SIPSIN_GROUP[d.stemSipsin], SIPSIN_GROUP[d.branchSipsin], d.isYongsin)}`);
    if (a.nextDaeun) dp.push(`${a.nextDaeun.fromAge}세부터는 ${ganziKo(a.nextDaeun)}(${ganziName(a.nextDaeun)}) 대운으로 넘어가요. 대운이 바뀌기 한두 해 전부터 환경이 먼저 움직이니, 그때쯤 "뭔가 바뀌네" 싶으면 이 말을 떠올리세요.`);
  } else if (a.age < saju.daeun.startAge) {
    dp.push(`아직 첫 대운 전이에요. ${saju.daeun.startAge}세에 ${ganziKo(saju.daeun.list[0])} 대운이 시작돼요.`);
  }
  sections.push({ id: 'daeun', title: '대운의 흐름', expression: 'normal', paragraphs: dp });

  // 9. 마무리
  const gm = saju.gongmang.map((b) => `${BRANCHES_KO[b]}(${BRANCHES[b]})`).join('·');
  const closing = [
    `정리할게요. ${you}은 ${dm.image} 같은 사람이고, ${el(a.strongestEl)}의 힘으로 살아가며, ${josa(el(a.yongsin), '을/를')} 가까이할 때 운이 풀려요. ${a.strength === '신강' ? '힘을 밖으로 쓰는 게' : a.strength === '신약' ? '도와주는 기운을 곁에 두는 게' : '균형을 지키는 게'} 평생의 숙제고요.`,
    `참, 일주 기준 공망은 ${eyo(gm)}. 이 글자가 들어오는 해엔 결과가 손에 덜 잡히는 느낌이 들 수 있어요. 그런 해엔 성과보다 준비에 집중하면 돼요.`,
    `(안경을 벗으며) 사주는 정해진 운명이 아니라 타고난 날씨예요. 비 오는 날은 우산을 챙기면 되듯, 흐름을 알고 준비하는 사람이 결국 잘 살아요. 더 궁금한 게 있으면 아래에서 물어보세요.`,
  ];
  sections.push({ id: 'closing', title: '묘선생의 정리', expression: 'happy', paragraphs: closing });

  return sections;
}

function seunText(ss, sb, s, a, you) {
  const g = SIPSIN_GROUP[SIPSIN.indexOf(ss)];
  const base = {
    비겁: '내 편이 늘고 활동이 많아지는 해예요. 사람 만날 일, 경쟁할 일이 늘어요. 대신 돈은 사람 때문에 나갈 수 있으니 보증·동업·큰 지출은 신중하게요.',
    식상: '표현하고 만들어내는 해예요. 새 프로젝트, 취미, 이직 준비처럼 "내 것"을 내놓기 좋아요. 말이 앞서기 쉬운 해이기도 하니 윗사람 앞에선 한 박자 쉬고요.',
    재성: '재물과 사람이 움직이는 해예요. 돈 벌 기회가 보이고 인연도 붙어요. 다만 욕심이 커지면 몸이 지치니, 건강 검진 한 번 챙기세요.',
    관성: '책임과 자리의 해예요. 승진, 시험, 직책, 계약처럼 "인정받는 일"이 들어와요. 부담도 함께 오니 몸을 아끼면서 가세요.',
    인성: '배우고 채우는 해예요. 공부, 자격, 문서, 어른의 도움이 들어와요. 결과를 서두르기보다 실력을 쌓는 해로 쓰면 다음 해에 크게 돌아와요.',
  }[g];
  const extra = s.isYongsin ? ' 게다가 올해 기운이 용신과 같아요. 흐름이 내 편인 해니 미뤄둔 일을 꺼내도 좋아요.' : '';
  return base + extra;
}

function daeunText(g1, g2, isYongsin) {
  const t = {
    비겁: '내 힘으로 개척하는 시기', 식상: '재능을 펼치고 표현하는 시기', 재성: '재물과 현실을 다지는 시기',
    관성: '자리와 책임이 커지는 시기', 인성: '배우고 준비하며 뿌리를 내리는 시기',
  };
  let s = `${t[g1]}`;
  if (g1 !== g2) s += `이면서 ${t[g2]}`;
  s += '예요.';
  s += isYongsin ? ' 용신 기운이 들어오는 대운이라 전체적으로 순풍이에요. 이 십 년 안에 기반을 만들어두세요.' : ' 용신과는 다른 기운이라 순풍만은 아니에요. 대신 이런 시기에 배운 게 다음 대운의 밑천이 돼요.';
  return s;
}

/** AI 프롬프트용 사실 요약 */
export function factSheet(saju, a, opts = {}) {
  const P = saju.pillars;
  const pillar = (k) => P[k] ? `${ganziName(P[k])}(${ganziKo(P[k])})` : '미상';
  const lines = [
    `이름: ${opts.name || '(비공개)'} / 성별: ${saju.input.gender === 'm' ? '남' : '여'} / 세는나이 ${a.age}세`,
    `양력 ${saju.solar.y}-${saju.solar.m}-${saju.solar.d} ${saju.input.hourKnown ? `${saju.input.hour}:${String(saju.input.minute || 0).padStart(2, '0')}` : '시간 미상'} / 음력 ${saju.lunar.y}-${saju.lunar.leap ? '윤' : ''}${saju.lunar.m}-${saju.lunar.d}`,
    `사주: 연주 ${pillar('year')} 월주 ${pillar('month')} 일주 ${pillar('day')} 시주 ${pillar('hour')}`,
    `일간: ${a.dayMaster.name} / 월지 절기: ${saju.term.name}`,
    `십신(일간 제외): ${a.chars.filter((c) => c.sipsin !== null).map((c) => `${POS_KO[c.pos]}${c.kind === 'stem' ? '천간' : '지지'} ${c.ch}=${SIPSIN[c.sipsin]}`).join(', ')}`,
    `오행 개수: ${ELEMENTS_KO.map((k, i) => `${k}${a.elementCount[i]}`).join(' ')} / 없는 오행: ${a.missing.map((i) => ELEMENTS_KO[i]).join(',') || '없음'}`,
    `신강약(간이 억부): ${a.strength} (지지율 ${a.strengthRatio}) / 득령 ${a.deukryeong ? '예' : '아니오'} / 용신(간이): ${ELEMENTS_KO[a.yongsin]}`,
    `합충: ${a.relations.map((r) => r.label).join(', ') || '없음'}`,
    `공망: ${saju.gongmang.map((b) => BRANCHES[b]).join('')}`,
    `대운: ${saju.daeun.startAge}세 ${saju.daeun.forward ? '순행' : '역행'} — ${saju.daeun.list.map((d) => `${d.fromAge}세 ${ganziName(d)}`).join(', ')}`,
    `현재 대운: ${a.currentDaeun ? `${a.currentDaeun.name} (${a.currentDaeun.fromAge}~${a.currentDaeun.toAge}세)` : '대운 전'}`,
    `올해 세운: ${a.seun.year}년 ${a.seun.name} — 천간 ${SIPSIN[a.seun.stemSipsin]}, 지지 ${SIPSIN[a.seun.branchSipsin]}${a.seun.chungWithDay ? ', 일지와 충' : ''}${a.seun.hapWithDay ? ', 일지와 합' : ''}`,
  ];
  return lines.join('\n');
}

export { ELEMENT_INFO, SIPSIN_GROUP, POS_KO };
