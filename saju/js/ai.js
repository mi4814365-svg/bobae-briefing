// Claude API 연동 — 브라우저에서 직접(raw HTTP) 또는 프록시(worker/)를 경유해 스트리밍한다.
// 설정은 localStorage에 저장: { mode: 'proxy'|'direct', proxyUrl, apiKey }
import { CHARACTER } from './character.js';

const SETTINGS_KEY = 'myounwoondang.ai';
export const MODEL = 'claude-opus-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* 저장 불가 환경 */ }
}
export function isConfigured() {
  const s = loadSettings();
  return (s.mode === 'proxy' && !!s.proxyUrl) || (s.mode === 'direct' && !!s.apiKey);
}

const GUARDRAILS = `
아래 <facts>는 만세력 계산으로 확정된 사실이에요. 글자를 바꾸거나 다시 계산하지 말고 그대로 근거로 쓰세요.
<facts>
{{FACTS}}
</facts>
답변 길이: 첫 심층 풀이는 한국어 900~1400자. 이어지는 질문에는 300~600자.
금지: 특정 날짜의 사고·질병·사망 예언, 의료·법률·투자에 대한 단정적 지시, 사용자를 겁주는 표현. 그런 질문엔 흐름과 대비법을 말하고 전문가 상담을 권해요.
`;

export function buildSystem(facts) {
  return [
    { type: 'text', text: CHARACTER.persona, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: GUARDRAILS.replace('{{FACTS}}', facts) },
  ];
}

/**
 * 스트리밍 호출. messages는 [{role, content}] 배열.
 * onText(delta), onDone({stopReason, text}), onError(err)
 */
export async function streamMessage({ system, messages, onText, onDone, onError, signal, maxTokens = 4000 }) {
  const s = loadSettings();
  const direct = s.mode === 'direct';
  const url = direct ? API_URL : s.proxyUrl;
  if (!url) { onError(new Error('AI 연결이 설정되지 않았어요.')); return; }

  const headers = {
    'content-type': 'application/json',
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'server-side-fallback-2026-07-01',
  };
  if (direct) {
    headers['x-api-key'] = s.apiKey;
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    stream: true,
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system,
    messages,
  };

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (e) {
    onError(new Error(direct ? '요청에 실패했어요. 키가 맞는지, 네트워크가 되는지 확인해 주세요.' : '프록시에 연결할 수 없어요. 주소를 확인해 주세요.'));
    return;
  }
  if (!res.ok) {
    let msg = `요청 실패 (${res.status})`;
    try { const j = await res.json(); if (j?.error?.message) msg += `: ${j.error.message}`; } catch { /* no body */ }
    onError(new Error(msg));
    return;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = '';
  let stopReason = null;
  let errored = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        let ev;
        try { ev = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          text += ev.delta.text; onText(ev.delta.text);
        } else if (ev.type === 'message_delta' && ev.delta?.stop_reason) {
          stopReason = ev.delta.stop_reason;
        } else if (ev.type === 'error') {
          errored = true; onError(new Error(ev.error?.message || '스트리밍 오류')); return;
        }
      }
    }
  } catch (e) {
    if (signal?.aborted) return;
    errored = true; onError(e); return;
  }
  if (!errored) onDone({ stopReason, text });
}
