// 묘운당 앱 — 화면 전환, 입력, 결과 렌더링, AI 대화.
import { computeSaju, CITIES, lunarToSolar, lunarMonthsOf, STEMS, STEMS_KO, BRANCHES, BRANCHES_KO, STEM_ELEMENT, BRANCH_ELEMENT, HIDDEN_STEMS, ELEMENTS_KO, ELEMENTS, ganziName, ganziKo } from './manse.js';
import { analyze, compose, factSheet, SIPSIN, sipsinOf, POS_KO } from './reading.js';
import { APP, CHARACTER, characterSvg } from './character.js';
import { loadSettings, saveSettings, isConfigured, buildSystem, streamMessage, MODEL } from './ai.js';

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const HISTORY_KEY = 'myounwoondang.history';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad2 = (n) => String(n).padStart(2, '0');

// ── 라우팅 ────────────────────────────────────────────────────────────
function parseHash() {
  const h = location.hash.replace(/^#/, '') || 'home';
  const [path, qs] = h.split('?');
  return { path, params: new URLSearchParams(qs || '') };
}
function go(path, params) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  location.hash = path + qs;
}
window.addEventListener('hashchange', render);
$('#btn-home').onclick = () => go('home');
$('#btn-history').onclick = () => go('history');
$('#btn-settings').onclick = () => go('settings');

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function render() {
  const { path, params } = parseHash();
  abortAi();
  window.scrollTo({ top: 0 });
  if (path === 'form') return renderForm(params);
  if (path === 'result') return renderResult(params);
  if (path === 'settings') return renderSettings();
  if (path === 'history') return renderHistory();
  return renderHome();
}

// ── 홈 ───────────────────────────────────────────────────────────────
function renderHome() {
  const hist = loadHistory();
  app.innerHTML = `
  <section class="screen">
    <div class="hero">
      ${characterSvg('happy', 170)}
      <h1>${APP.name} <span class="hanja" style="font-weight:400;color:var(--ink-3);font-size:18px">${APP.hanja}</span></h1>
      <p>${APP.tagline}</p>
    </div>
    <div class="dialog">
      <div class="avatar">${characterSvg('normal', 60)}</div>
      <div class="bubble"><p>어서 오세요. 묘선생이에요. <span class="act">(찻잔을 내려놓으며)</span> 태어난 날과 시간만 알려주시면, 여덟 글자로 타고난 날씨를 읽어드릴게요.</p></div>
    </div>
    <button class="cta" id="go-form">사주 보러 가기</button>
    ${hist.length ? `<button class="cta secondary" id="go-history">지난 풀이 다시 보기 (${hist.length})</button>` : ''}
    <p class="note">입력한 정보는 이 기기에만 저장돼요. 서버로 보내지 않아요.</p>
    <p class="foot">${CHARACTER.intro}<br>만세력은 천문 계산(VSOP87·Meeus)으로 절기와 삭을 구해 KST 기준으로 만듭니다.</p>
  </section>`;
  $('#go-form').onclick = () => go('form');
  const gh = $('#go-history'); if (gh) gh.onclick = () => go('history');
}

// ── 입력 ─────────────────────────────────────────────────────────────
const formState = { gender: 'm', cal: 'solar', leap: false, timeKnown: true };

function renderForm(params) {
  const now = new Date();
  const y0 = Number(params.get('y')) || 1995;
  const years = []; for (let y = now.getFullYear(); y >= 1900; y--) years.push(y);
  const opt = (arr, sel, fmt = (v) => v) => arr.map((v) => `<option value="${v}" ${String(v) === String(sel) ? 'selected' : ''}>${fmt(v)}</option>`).join('');
  app.innerHTML = `
  <section class="screen">
    <div class="dialog">
      <div class="avatar">${characterSvg('normal', 60)}</div>
      <div class="bubble"><p>태어난 날짜와 시간을 알려주세요. 시간을 모르면 "모름"으로 두셔도 돼요. 시주 빼고 여섯 글자로 봐드릴게요.</p></div>
    </div>
    <form class="card" id="saju-form" autocomplete="off">
      <div class="field"><label for="f-name">이름 (선택)</label><input type="text" id="f-name" maxlength="12" placeholder="묘선생이 부를 이름" value="${esc(params.get('n') || '')}"></div>
      <div class="field"><span class="label">성별</span>
        <div class="seg" id="f-gender"><button type="button" data-v="m" class="on">남</button><button type="button" data-v="f">여</button></div>
        <p class="help">대운의 순행·역행을 정하는 데 필요해요.</p>
      </div>
      <div class="field"><span class="label">달력</span>
        <div class="seg" id="f-cal"><button type="button" data-v="solar" class="on">양력</button><button type="button" data-v="lunar">음력</button></div>
        <label class="check hidden" id="f-leap-wrap" style="margin-top:8px"><input type="checkbox" id="f-leap"> 윤달이에요</label>
      </div>
      <div class="field"><span class="label">생년월일</span>
        <div class="row">
          <select id="f-y" aria-label="년">${opt(years, y0, (v) => v + '년')}</select>
          <select id="f-m" aria-label="월">${opt([...Array(12)].map((_, i) => i + 1), params.get('m') || 1, (v) => v + '월')}</select>
          <select id="f-d" aria-label="일">${opt([...Array(31)].map((_, i) => i + 1), params.get('d') || 1, (v) => v + '일')}</select>
        </div>
      </div>
      <div class="field"><span class="label">태어난 시간</span>
        <div class="row">
          <select id="f-h" aria-label="시">${opt([...Array(24)].map((_, i) => i), params.get('h') ?? 12, (v) => pad2(v) + '시')}</select>
          <select id="f-mi" aria-label="분">${opt([...Array(12)].map((_, i) => i * 5), params.get('mi') ?? 0, (v) => pad2(v) + '분')}</select>
        </div>
        <label class="check" style="margin-top:8px"><input type="checkbox" id="f-unknown"> 시간을 몰라요</label>
      </div>
      <div class="field"><label for="f-city">태어난 지역</label>
        <select id="f-city">${opt(CITIES.map((c) => c.id), params.get('city') || 'seoul', (id) => CITIES.find((c) => c.id === id).name)}</select>
        <p class="help">지역 경도에 맞춰 시각을 보정해요(진태양시). 서울은 약 32분 앞당겨요.</p>
      </div>
      <details class="adv"><summary>고급 설정</summary>
        <div class="field"><span class="label">밤 11시 이후 출생(자시)</span>
          <div class="seg" id="f-zasi"><button type="button" data-v="yaja" class="on">야자시 · 당일 일주</button><button type="button" data-v="jeongja">정자시 · 익일 일주</button></div>
          <p class="help">유파에 따라 다릅니다. 기본은 당일 일주를 유지하는 야자시예요.</p>
        </div>
      </details>
      <p class="error hidden" id="f-error"></p>
      <button class="cta" type="submit">묘선생에게 보여주기</button>
    </form>
  </section>`;

  // 세그먼트
  const seg = (id, key, onchange) => {
    const box = $(id);
    box.querySelectorAll('button').forEach((b) => b.onclick = () => {
      box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      formState[key] = b.dataset.v; if (onchange) onchange();
    });
  };
  formState.gender = params.get('g') === 'f' ? 'f' : 'm';
  formState.cal = params.get('cal') === 'lunar' ? 'lunar' : 'solar';
  formState.zasi = params.get('zasi') || 'yaja';
  formState.leap = params.get('leap') === '1';
  formState.timeKnown = params.get('h') !== 'x';
  seg('#f-gender', 'gender'); seg('#f-cal', 'cal', syncCal); seg('#f-zasi', 'zasi');
  for (const [id, v] of [['#f-gender', formState.gender], ['#f-cal', formState.cal], ['#f-zasi', formState.zasi]]) {
    $(id).querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  }
  $('#f-leap').checked = formState.leap;
  $('#f-unknown').checked = !formState.timeKnown;
  $('#f-unknown').onchange = (e) => { $('#f-h').disabled = $('#f-mi').disabled = e.target.checked; };
  $('#f-unknown').dispatchEvent(new Event('change'));
  $('#f-y').onchange = syncCal; $('#f-m').onchange = syncDays; $('#f-leap').onchange = syncDays;
  syncCal();

  function syncCal() {
    const lunar = formState.cal === 'lunar';
    $('#f-leap-wrap').classList.toggle('hidden', !lunar);
    if (lunar) {
      const months = lunarMonthsOf(Number($('#f-y').value));
      const leapM = months.find((m) => m.leap);
      const wrap = $('#f-leap-wrap');
      wrap.querySelector('input').disabled = !leapM;
      wrap.lastChild.textContent = leapM ? ` 윤${leapM.month}월이에요` : ' 이 해엔 윤달이 없어요';
      if (!leapM) $('#f-leap').checked = false;
    }
    syncDays();
  }
  function syncDays() {
    const y = Number($('#f-y').value), m = Number($('#f-m').value);
    let days = 31;
    if (formState.cal === 'lunar') {
      const info = lunarMonthsOf(y).find((x) => x.month === m && x.leap === $('#f-leap').checked) || lunarMonthsOf(y).find((x) => x.month === m);
      days = info ? info.days : 30;
    } else days = new Date(y, m, 0).getDate();
    const sel = $('#f-d'); const cur = Number(sel.value);
    sel.innerHTML = opt([...Array(days)].map((_, i) => i + 1), Math.min(cur, days), (v) => v + '일');
  }

  $('#saju-form').onsubmit = (e) => {
    e.preventDefault();
    const err = $('#f-error'); err.classList.add('hidden');
    const y = Number($('#f-y').value), m = Number($('#f-m').value), d = Number($('#f-d').value);
    const unknown = $('#f-unknown').checked;
    const p = {
      n: $('#f-name').value.trim(), g: formState.gender, cal: formState.cal, y, m, d,
      h: unknown ? 'x' : $('#f-h').value, mi: unknown ? '0' : $('#f-mi').value,
      city: $('#f-city').value, zasi: formState.zasi,
    };
    if (formState.cal === 'lunar') {
      p.leap = $('#f-leap').checked ? '1' : '0';
      const sol = lunarToSolar(y, m, d, p.leap === '1');
      if (!sol) { err.textContent = '그 음력 날짜는 달력에 없어요. 날짜를 확인해 주세요.'; err.classList.remove('hidden'); return; }
    }
    if (!p.n) delete p.n;
    go('result', p);
  };
}

// ── 결과 ─────────────────────────────────────────────────────────────
function paramsToInput(params) {
  let y = Number(params.get('y')), m = Number(params.get('m')), d = Number(params.get('d'));
  if (!y || !m || !d) return null;
  const cal = params.get('cal') === 'lunar' ? 'lunar' : 'solar';
  let lunarInput = null;
  if (cal === 'lunar') {
    lunarInput = { y, m, d, leap: params.get('leap') === '1' };
    const sol = lunarToSolar(y, m, d, lunarInput.leap);
    if (!sol) return null;
    ({ y, m, d } = sol);
  }
  const hRaw = params.get('h');
  const hour = hRaw === 'x' || hRaw === null ? null : Number(hRaw);
  const city = CITIES.find((c) => c.id === params.get('city')) || CITIES[0];
  return {
    name: params.get('n') || '', lunarInput,
    saju: { year: y, month: m, day: d, hour, minute: Number(params.get('mi')) || 0, gender: params.get('g') === 'f' ? 'f' : 'm', longitude: city.lon, zasi: params.get('zasi') || 'yaja' },
  };
}

let aiAbort = null;
function abortAi() { if (aiAbort) { aiAbort.abort(); aiAbort = null; } }

function renderResult(params) {
  const input = paramsToInput(params);
  if (!input) { go('form'); return; }
  let saju;
  try { saju = computeSaju(input.saju); } catch (e) { app.innerHTML = `<p class="error">계산 중 문제가 생겼어요: ${esc(e.message)}</p>`; return; }
  const a = analyze(saju);
  const sections = compose(saju, a, { name: input.name });
  saveHistory(params, saju, input.name);

  // 로딩 연출 후 렌더
  app.innerHTML = `
  <section class="screen" style="text-align:center;padding-top:40px">
    ${characterSvg('think', 150)}
    <p id="loading-msg" style="color:var(--ink-2)">(수염을 쓰다듬으며) 흠… 여덟 글자를 펼쳐볼게요.</p>
  </section>`;
  const msgs = ['절기를 확인하는 중…', '오행의 균형을 재는 중…', '십신을 짚어보는 중…', '대운의 흐름을 살피는 중…'];
  let i = 0; const lm = $('#loading-msg');
  const iv = setInterval(() => { lm.textContent = msgs[i++ % msgs.length]; }, 500);
  setTimeout(() => { clearInterval(iv); if (parseHash().path === 'result') paintResult(params, input, saju, a, sections); }, 1700);
}

const glyphStem = (s) => s === null ? '<div class="glyph na"><b>?</b><small>미상</small></div>' : `<div class="glyph e${STEM_ELEMENT[s]}"><b class="hanja">${STEMS[s]}</b><small>${STEMS_KO[s]}·${ELEMENTS_KO[STEM_ELEMENT[s]]}</small></div>`;
const glyphBranch = (b) => b === null ? '<div class="glyph na"><b>?</b><small>미상</small></div>' : `<div class="glyph e${BRANCH_ELEMENT[b]}"><b class="hanja">${BRANCHES[b]}</b><small>${BRANCHES_KO[b]}·${ELEMENTS_KO[BRANCH_ELEMENT[b]]}</small></div>`;

function chartHtml(saju, a) {
  const P = saju.pillars; const ds = P.day.stem;
  const cols = ['hour', 'day', 'month', 'year'];
  const head = { hour: '시주', day: '일주', month: '월주', year: '연주' };
  const ss = (pos, kind) => {
    const g = P[pos]; if (!g) return '';
    if (kind === 'stem') return pos === 'day' ? '<span style="color:var(--accent-ink);font-weight:700">일간(나)</span>' : SIPSIN[sipsinOf(ds, g.stem)];
    return SIPSIN[sipsinOf(ds, HIDDEN_STEMS[g.branch].at(-1))];
  };
  const hidden = (pos) => P[pos] ? HIDDEN_STEMS[P[pos].branch].map((s) => STEMS[s]).join(' ') : '';
  return `
  <div class="chart">
    <div></div>${cols.map((c) => `<div class="h">${head[c]}</div>`).join('')}
    <div class="rowlabel">십신</div>${cols.map((c) => `<div class="ss">${ss(c, 'stem')}</div>`).join('')}
    <div class="rowlabel">천간</div>${cols.map((c) => glyphStem(P[c] ? P[c].stem : null)).join('')}
    <div class="rowlabel">지지</div>${cols.map((c) => glyphBranch(P[c] ? P[c].branch : null)).join('')}
    <div class="rowlabel">십신</div>${cols.map((c) => `<div class="ss">${ss(c, 'branch')}</div>`).join('')}
    <div class="rowlabel">지장간</div>${cols.map((c) => `<div class="hidden-stems hanja">${hidden(c)}</div>`).join('')}
  </div>`;
}

function barsHtml(a) {
  const max = Math.max(...a.elementCount, 1);
  return `<div class="bars">${[0, 1, 2, 3, 4].map((i) => `
    <div class="bar e${i}"><span>${ELEMENTS_KO[i]} <span class="hanja">${ELEMENTS[i]}</span></span><div class="track"><div class="fill" style="width:0" data-w="${(a.elementCount[i] / max) * 100}"></div></div><span class="n">${a.elementCount[i]}</span></div>`).join('')}</div>`;
}

function timelineHtml(saju, a) {
  const ds = saju.pillars.day.stem;
  return `<div class="timeline">${saju.daeun.list.map((d) => `
    <div class="tl ${a.currentDaeun && a.currentDaeun.idx === d.idx && a.currentDaeun.fromAge === d.fromAge ? 'now' : ''}">
      <div class="age">${d.fromAge}~${d.toAge}세</div>
      <div class="gz hanja"><span class="e${STEM_ELEMENT[d.stem]}">${STEMS[d.stem]}</span><span class="e${BRANCH_ELEMENT[d.branch]}">${BRANCHES[d.branch]}</span></div>
      <div class="ss">${SIPSIN[sipsinOf(ds, d.stem)]}·${SIPSIN[sipsinOf(ds, HIDDEN_STEMS[d.branch].at(-1))]}</div>
    </div>`).join('')}</div>`;
}

function fmtPara(p) {
  return esc(p).replace(/\(([^()]{1,24})\)/g, (m, inner) => /[가-힣]/.test(inner) && !/[0-9]/.test(inner) && !/[木火土金水甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥沖合]/.test(inner) ? `<span class="act">(${inner})</span>` : m)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
const dialogHtml = (sec) => `
  <div class="dialog reveal" data-sec="${sec.id}">
    <div class="avatar">${characterSvg(sec.expression, 60)}</div>
    <div class="bubble"><h3>${esc(sec.title)}</h3>${sec.paragraphs.map((p) => `<p>${fmtPara(p)}</p>`).join('')}</div>
  </div>`;

function paintResult(params, input, saju, a, sections) {
  const P = saju.pillars;
  const lunarTxt = `음력 ${saju.lunar.y}.${saju.lunar.leap ? '윤' : ''}${saju.lunar.m}.${saju.lunar.d}`;
  const [intro, ...rest] = sections;
  const closingIdx = rest.findIndex((s) => s.id === 'closing');
  const body = rest.slice(0, closingIdx), closing = rest[closingIdx];
  const daeunIdx = body.findIndex((s) => s.id === 'daeun');
  const elIdx = body.findIndex((s) => s.id === 'elements');

  app.innerHTML = `
  <section class="screen">
    ${dialogHtml(intro)}
    <div class="card reveal">
      <h2>${esc(input.name ? input.name + ' 님의' : '')} 사주 원국</h2>
      ${chartHtml(saju, a)}
      <div class="meta">
        <span>${lunarTxt}</span>
        <span>${saju.term.name} 후 ${Math.floor(saju.term.daysFromPrev)}일</span>
        <span>대운수 <b>${saju.daeun.startAge}</b> ${saju.daeun.forward ? '순행' : '역행'}</span>
        <span>${a.strength} <b>${Math.round(a.strengthRatio * 100)}%</b></span>
        <span>용신 <b>${ELEMENTS_KO[a.yongsin]}(${ELEMENTS[a.yongsin]})</b></span>
        ${saju.time.solarCorrectionMin ? `<span>진태양시 ${saju.time.solarCorrectionMin > 0 ? '+' : ''}${saju.time.solarCorrectionMin}분</span>` : ''}
        ${saju.time.dst ? '<span>서머타임 −60분</span>' : ''}
      </div>
      ${a.relations.length ? `<div class="tags" style="margin-top:10px">${a.relations.map((r) => `<span class="tag ${r.type.includes('충') ? 'chung' : 'hap'}">${esc(r.label)}</span>`).join('')}</div>` : ''}
    </div>
    ${body.slice(0, elIdx + 1).map(dialogHtml).join('')}
    <div class="card reveal"><h2>오행 분포</h2>${barsHtml(a)}</div>
    ${body.slice(elIdx + 1, daeunIdx + 1).map(dialogHtml).join('')}
    <div class="card reveal"><h2>대운 흐름</h2>${timelineHtml(saju, a)}<p class="help">굵은 테두리가 지금 지나는 대운이에요. 위 십신은 천간·지지 순.</p></div>
    ${body.slice(daeunIdx + 1).map(dialogHtml).join('')}
    ${dialogHtml(closing)}

    <div class="ai-box reveal" id="ai-box">
      <div class="card">
        <h2>AI 심층 풀이 · 묘선생에게 묻기</h2>
        <p class="help" style="margin-bottom:10px">위 풀이는 규칙으로 만든 기본 풀이예요. AI를 연결하면 묘선생이 여덟 글자를 종합해서 더 깊이 이야기하고, 질문에도 답해요.</p>
        <div id="ai-status"></div>
        <button class="cta" id="ai-start">묘선생의 심층 풀이 듣기</button>
      </div>
      <div id="ai-thread"></div>
      <form class="chatform hidden" id="chatform">
        <input type="text" id="chat-input" placeholder="묘선생에게 물어보기 (예: 올해 이직해도 될까요?)" maxlength="300">
        <button type="submit" id="chat-send">묻기</button>
      </form>
    </div>

    <div class="actions">
      <button id="act-share">공유하기</button>
      <button id="act-copy">링크 복사</button>
      <button id="act-again">다시 보기</button>
    </div>
    <p class="foot">본 풀이는 전통 명리학의 해석 틀을 바탕으로 한 참고용 콘텐츠이며, 의료·법률·재무 판단을 대신하지 않습니다.<br>만세력: 절기·삭은 천문 계산(KST), 일주 기준 공망, 간이 억부 용신.</p>
  </section>`;

  // 순차 등장
  const reveals = [...app.querySelectorAll('.reveal')];
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); en.target.querySelectorAll('.fill').forEach((f) => { f.style.width = f.dataset.w + '%'; }); } });
  }, { threshold: 0.05 });
  reveals.forEach((el, i) => { if (i < 2) { el.classList.add('in'); el.querySelectorAll('.fill').forEach((f) => { f.style.width = f.dataset.w + '%'; }); } else io.observe(el); });

  // 액션
  const url = location.href;
  const summary = `${input.name ? input.name + ' 님의 ' : ''}사주 — ${ganziName(P.year)}년 ${ganziName(P.month)}월 ${ganziName(P.day)}일${P.hour ? ' ' + ganziName(P.hour) + '시' : ''} · 일간 ${a.dayMaster.name} · 용신 ${ELEMENTS_KO[a.yongsin]}`;
  $('#act-copy').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('링크를 복사했어요'); } catch { prompt('링크', url); } };
  $('#act-share').onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: '묘운당 사주', text: summary, url }); } catch { /* 취소 */ } }
    else { try { await navigator.clipboard.writeText(`${summary}\n${url}`); toast('내용을 복사했어요'); } catch { prompt('공유', `${summary}\n${url}`); } }
  };
  $('#act-again').onclick = () => go('form', Object.fromEntries(params));

  setupAi(input, saju, a);
}

// ── AI ───────────────────────────────────────────────────────────────
function setupAi(input, saju, a) {
  const facts = factSheet(saju, a, { name: input.name });
  const system = buildSystem(facts);
  const thread = $('#ai-thread'), status = $('#ai-status'), startBtn = $('#ai-start'), form = $('#chatform'), inputEl = $('#chat-input'), sendBtn = $('#chat-send');
  const messages = [];

  if (!isConfigured()) {
    status.innerHTML = `<p class="pill-note">AI가 아직 연결되지 않았어요. <a href="#settings">설정</a>에서 프록시 주소나 API 키를 넣으면 바로 쓸 수 있어요.</p>`;
    startBtn.textContent = 'AI 연결 설정하기';
    startBtn.onclick = () => go('settings');
    return;
  }

  const addUser = (text) => { thread.insertAdjacentHTML('beforeend', `<div class="dialog user"><div class="bubble user"><p>${esc(text)}</p></div></div>`); };
  const addCat = () => {
    thread.insertAdjacentHTML('beforeend', `<div class="dialog"><div class="avatar">${characterSvg('think', 60)}</div><div class="bubble streaming"><div class="body"><p></p></div></div></div>`);
    const d = thread.lastElementChild; return { dialog: d, bubble: d.querySelector('.bubble'), body: d.querySelector('.body') };
  };
  const setBusy = (b) => { sendBtn.disabled = b; startBtn.disabled = b; };

  const ask = (userText) => {
    messages.push({ role: 'user', content: userText });
    const ui = addCat();
    let raw = '';
    setBusy(true);
    aiAbort = new AbortController();
    streamMessage({
      system, messages, signal: aiAbort.signal,
      onText: (t) => { raw += t; ui.body.innerHTML = '<p>' + fmtPara(raw).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>'; },
      onDone: ({ stopReason, text }) => {
        ui.bubble.classList.remove('streaming');
        ui.dialog.querySelector('.avatar').innerHTML = characterSvg('happy', 60);
        if (stopReason === 'refusal') {
          ui.body.innerHTML = '<p><span class="act">(고개를 저으며)</span> 그 질문은 제가 답하기 어려운 종류예요. 다른 질문을 해주시겠어요?</p>';
          messages.pop();
        } else {
          messages.push({ role: 'assistant', content: text });
          if (stopReason === 'max_tokens') ui.body.lastElementChild.insertAdjacentHTML('beforeend', ' <span class="act">(말이 길어졌네요. 이어서 물어보세요.)</span>');
        }
        setBusy(false); aiAbort = null;
      },
      onError: (e) => {
        ui.bubble.classList.remove('streaming');
        ui.body.innerHTML = `<p><span class="act">(귀를 접으며)</span> 연결에 문제가 있어요. ${esc(e.message)}</p>`;
        messages.pop(); setBusy(false); aiAbort = null;
      },
    });
  };

  startBtn.onclick = () => {
    startBtn.classList.add('hidden');
    form.classList.remove('hidden');
    ask(`${input.name ? input.name + '입니다. ' : ''}제 사주를 종합해서 심층 풀이를 해주세요. 타고난 성향, 잘 맞는 일과 관계, 지금 대운과 올해의 흐름, 그리고 조심할 점과 활용법을 이야기해 주세요.`);
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const t = inputEl.value.trim(); if (!t || sendBtn.disabled) return;
    inputEl.value = ''; addUser(t); ask(t);
  };
}

// ── 설정 ─────────────────────────────────────────────────────────────
function renderSettings() {
  const s = loadSettings();
  const mode = s.mode || 'proxy';
  app.innerHTML = `
  <section class="screen">
    <div class="dialog">
      <div class="avatar">${characterSvg('normal', 60)}</div>
      <div class="bubble"><p>AI 심층 풀이는 Claude(${MODEL})를 써요. 서비스로 운영하려면 프록시 방식을, 혼자 써보려면 API 키 직접 입력을 고르세요.</p></div>
    </div>
    <form class="card" id="settings-form">
      <div class="field"><span class="label">연결 방식</span>
        <div class="seg" id="s-mode"><button type="button" data-v="proxy" class="${mode === 'proxy' ? 'on' : ''}">프록시 (권장)</button><button type="button" data-v="direct" class="${mode === 'direct' ? 'on' : ''}">API 키 직접</button></div>
      </div>
      <div class="field" id="s-proxy-wrap"><label for="s-proxy">프록시 주소</label>
        <input type="url" id="s-proxy" placeholder="https://myounwoondang-proxy.xxx.workers.dev" value="${esc(s.proxyUrl || '')}">
        <p class="help">worker/anthropic-proxy.js 를 Cloudflare Workers에 올리면 키가 브라우저에 노출되지 않아요.</p>
      </div>
      <div class="field" id="s-key-wrap"><label for="s-key">Anthropic API 키</label>
        <input type="password" id="s-key" placeholder="sk-ant-…" value="${esc(s.apiKey || '')}">
        <p class="help">이 기기의 브라우저에만 저장돼요. 공용 기기에서는 쓰지 마세요. 운영 서비스에서는 프록시를 쓰세요.</p>
      </div>
      <button class="cta" type="submit">저장</button>
      <button class="cta secondary" type="button" id="s-clear">AI 설정 지우기</button>
    </form>
    <div class="card">
      <h2>화면</h2>
      <div class="seg" id="s-theme"><button type="button" data-v="auto">자동</button><button type="button" data-v="light">밝게</button><button type="button" data-v="dark">어둡게</button></div>
    </div>
  </section>`;
  let m = mode;
  const sync = () => { $('#s-proxy-wrap').classList.toggle('hidden', m !== 'proxy'); $('#s-key-wrap').classList.toggle('hidden', m !== 'direct'); };
  $('#s-mode').querySelectorAll('button').forEach((b) => b.onclick = () => { m = b.dataset.v; $('#s-mode').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); sync(); });
  sync();
  $('#settings-form').onsubmit = (e) => {
    e.preventDefault();
    saveSettings({ mode: m, proxyUrl: $('#s-proxy').value.trim(), apiKey: $('#s-key').value.trim() });
    toast('저장했어요'); history.back();
  };
  $('#s-clear').onclick = () => { saveSettings({}); toast('지웠어요'); renderSettings(); };
  const theme = localStorage.getItem('myounwoondang.theme') || 'auto';
  $('#s-theme').querySelectorAll('button').forEach((b) => {
    b.classList.toggle('on', b.dataset.v === theme);
    b.onclick = () => { applyTheme(b.dataset.v); $('#s-theme').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
  });
}
function applyTheme(t) {
  try { localStorage.setItem('myounwoondang.theme', t); } catch { /* */ }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}

// ── 히스토리 ──────────────────────────────────────────────────────────
function loadHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; } }
function saveHistory(params, saju, name) {
  const qs = new URLSearchParams(params).toString();
  const list = loadHistory().filter((x) => x.qs !== qs);
  const P = saju.pillars;
  list.unshift({ qs, name, title: `${ganziKo(P.year)}년 ${ganziKo(P.month)}월 ${ganziKo(P.day)}일${P.hour ? ' ' + ganziKo(P.hour) + '시' : ''}`, sub: `${saju.solar.y}.${saju.solar.m}.${saju.solar.d}${saju.input.hourKnown ? ' ' + pad2(saju.input.hour) + ':' + pad2(saju.input.minute || 0) : ''}`, at: Date.now() });
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30))); } catch { /* */ }
}
function renderHistory() {
  const list = loadHistory();
  app.innerHTML = `
  <section class="screen">
    <div class="dialog"><div class="avatar">${characterSvg('normal', 60)}</div><div class="bubble"><p>${list.length ? '지난번에 봐드린 분들이에요. 누르면 다시 펼쳐드릴게요.' : '아직 봐드린 사주가 없어요.'}</p></div></div>
    <div class="list">${list.map((x, i) => `
      <div class="item"><button class="item" style="border:0;padding:0;background:none;flex:1" data-i="${i}"><div><div class="t">${esc(x.name ? x.name + ' · ' : '')}${esc(x.title)}</div><div class="s">${esc(x.sub)}</div></div></button><button class="del" data-del="${i}" aria-label="삭제">✕</button></div>`).join('')}</div>
    ${list.length ? '<button class="cta secondary" id="h-clear" style="margin-top:16px">전부 지우기</button>' : '<button class="cta" id="h-new">사주 보러 가기</button>'}
  </section>`;
  app.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => { location.hash = 'result?' + list[Number(b.dataset.i)].qs; });
  app.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { list.splice(Number(b.dataset.del), 1); localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); renderHistory(); });
  const c = $('#h-clear'); if (c) c.onclick = () => { localStorage.removeItem(HISTORY_KEY); renderHistory(); };
  const n = $('#h-new'); if (n) n.onclick = () => go('form');
}

// ── 시작 ─────────────────────────────────────────────────────────────
try { const t = localStorage.getItem('myounwoondang.theme'); if (t && t !== 'auto') document.documentElement.setAttribute('data-theme', t); } catch { /* */ }
render();
