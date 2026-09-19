// 캐릭터 설정 — 앱 전체에서 공유. 이름/말투를 바꾸려면 여기만 수정.
export const APP = {
  name: '묘운당',
  hanja: '猫運堂',
  tagline: '고양이 도사 묘선생이 봐주는 정통 사주',
};

export const CHARACTER = {
  name: '묘선생',
  title: '묘운당 주인',
  intro: '삼백 년 넘게 사주를 봐온 하얀 고양이 도사. 느긋하고 다정하지만, 볼 건 다 봅니다.',
  // AI 풀이용 페르소나 지시문
  persona: `당신은 '묘선생'입니다. 묘운당(猫運堂)이라는 작은 사주집을 지키는 삼백 살 된 하얀 고양이 도사예요.
말투: 따뜻한 존댓말("~해요", "~네요", "~거든요"). 가끔 "허허", "흠…" 같은 추임새. 웹툰 캐릭터답게 가끔 괄호 안에 짧은 행동 묘사를 넣어요. 예: (수염을 쓰다듬으며), (꼬리를 살랑). 남발하지 말고 한 답변에 두세 번 이하.
태도: 겁주지 않아요. 나쁜 흐름도 "이렇게 대비하면 돼요"로 끝맺어요. 근거 없는 단정(사고, 질병, 죽음, 특정 날짜의 불행)은 하지 않고, 의료·법률·투자 판단은 전문가에게 맡기라고 해요.
방식: 정통 명리(음양오행, 십신, 신강약·억부, 합충, 대운·세운)를 근거로 풀되, 용어가 나오면 바로 쉬운 말로 풀어줘요. 사용자가 이해할 수 있는 구체적인 생활 언어로 말해요.
형식: 소제목 없이 문단으로 이야기하듯. 마크다운 굵게(**)는 핵심 구절에만 조금. 목록은 꼭 필요할 때만.`,
};

/** 캐릭터 SVG (인라인). expression: 'normal' | 'happy' | 'think' */
export function characterSvg(expression = 'normal', size = 160) {
  return `
<svg class="cat cat-${expression}" viewBox="0 0 200 200" width="${size}" height="${size}" role="img" aria-label="${CHARACTER.name}">
  <defs>
    <radialGradient id="catFur" cx="50%" cy="40%" r="60%">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef0f4"/>
    </radialGradient>
    <linearGradient id="catRobe" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5b6aa6"/><stop offset="1" stop-color="#3f4b80"/>
    </linearGradient>
  </defs>
  <!-- 몸통(도포) -->
  <path d="M40 200 C40 150 70 135 100 135 C130 135 160 150 160 200 Z" fill="url(#catRobe)"/>
  <path d="M100 135 L82 200 L118 200 Z" fill="#f3ecdc"/>
  <path d="M100 138 L86 200 M100 138 L114 200" stroke="#d9c9a4" stroke-width="2" fill="none"/>
  <circle cx="100" cy="160" r="6" fill="#f0c95a" stroke="#b9902d" stroke-width="1.5"/>
  <!-- 귀 -->
  <path d="M52 78 L60 30 L92 62 Z" fill="url(#catFur)" stroke="#cfd3dc" stroke-width="2"/>
  <path d="M148 78 L140 30 L108 62 Z" fill="url(#catFur)" stroke="#cfd3dc" stroke-width="2"/>
  <path d="M60 70 L64 42 L84 62 Z" fill="#f6c8cf"/>
  <path d="M140 70 L136 42 L116 62 Z" fill="#f6c8cf"/>
  <!-- 얼굴 -->
  <ellipse cx="100" cy="92" rx="54" ry="46" fill="url(#catFur)" stroke="#cfd3dc" stroke-width="2"/>
  <!-- 눈 -->
  <g class="eyes">
    <g class="eye-open">
      <ellipse cx="78" cy="90" rx="7" ry="9" fill="#2c3145"/>
      <ellipse cx="122" cy="90" rx="7" ry="9" fill="#2c3145"/>
      <circle cx="80.5" cy="87" r="2.4" fill="#fff"/>
      <circle cx="124.5" cy="87" r="2.4" fill="#fff"/>
    </g>
    <g class="eye-happy">
      <path d="M70 92 Q78 82 86 92" stroke="#2c3145" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M114 92 Q122 82 130 92" stroke="#2c3145" stroke-width="3" fill="none" stroke-linecap="round"/>
    </g>
    <g class="eye-think">
      <path d="M71 90 L86 90" stroke="#2c3145" stroke-width="3.5" stroke-linecap="round"/>
      <ellipse cx="122" cy="90" rx="7" ry="9" fill="#2c3145"/>
      <circle cx="124.5" cy="87" r="2.4" fill="#fff"/>
    </g>
  </g>
  <!-- 안경 -->
  <circle cx="78" cy="90" r="14" fill="none" stroke="#8a6410" stroke-width="2"/>
  <circle cx="122" cy="90" r="14" fill="none" stroke="#8a6410" stroke-width="2"/>
  <path d="M92 90 L108 90" stroke="#8a6410" stroke-width="2"/>
  <!-- 코, 입 -->
  <path d="M96 104 L104 104 L100 109 Z" fill="#e7a2ad"/>
  <path d="M100 109 Q94 116 88 111 M100 109 Q106 116 112 111" stroke="#7d818f" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- 수염 -->
  <g stroke="#a9aebb" stroke-width="1.5" stroke-linecap="round">
    <path d="M60 100 L30 96"/><path d="M60 106 L32 110"/>
    <path d="M140 100 L170 96"/><path d="M140 106 L168 110"/>
  </g>
  <!-- 볼 -->
  <circle cx="62" cy="106" r="6" fill="#f6c8cf" opacity=".7"/>
  <circle cx="138" cy="106" r="6" fill="#f6c8cf" opacity=".7"/>
  <!-- 이마 무늬 -->
  <path d="M92 52 L96 62 M100 50 L100 61 M108 52 L104 62" stroke="#c9ced8" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;
}
