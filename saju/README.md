# 묘운당 (猫運堂) — 묘선생의 정통 사주

고양이 도사 캐릭터 "묘선생"이 사주팔자를 풀어주는 웹앱. 빌드 없이 정적 파일만으로 동작하며, GitHub Pages의 `/saju/` 경로에 올라갑니다.

## 구성

```
saju/
├─ index.html            앱 셸
├─ css/app.css           스타일 (라이트/다크)
├─ js/
│  ├─ astro.js           율리우스일, ΔT, 절기·삭 계산 (Meeus)
│  ├─ vsop.js            VSOP87 절단 급수 — 태양 시황경 (절기 시각, 분 단위 정확)
│  ├─ manse.js           만세력: 사주 원국, 음양력 변환(KST, 윤달), 대운, 공망
│  ├─ reading.js         해석 엔진: 십신·오행·신강약·용신·합충·세운 + 묘선생 말투 풀이
│  ├─ character.js       앱 이름·캐릭터 페르소나·SVG (이름/말투는 여기서만 바꾸면 됨)
│  ├─ ai.js              Claude API 스트리밍 (프록시 또는 직접 호출)
│  └─ app.js             화면(홈·입력·결과·설정·히스토리)
├─ worker/               Cloudflare Worker 프록시 (API 키 숨김)
└─ test/                 node --test 엔진 테스트
```

## 만세력 규칙

- 절기(입춘·경칩…)는 태양 시황경을 VSOP87로 계산해 KST 기준으로 구합니다. 연주는 입춘, 월주는 12절(節)로 나눕니다.
- 음력은 삭(Meeus ch.49)과 중기(中氣)로 직접 계산합니다. 동지를 품은 달이 11월, 중기 없는 첫 달이 윤달. 한국천문연구원과 같은 KST 기준입니다.
- 시주는 출생지 경도로 진태양시를 보정합니다(서울 −32분). 1954~1961년 UTC+8:30, 한국 서머타임(1948~1960, 1987~1988)도 반영합니다.
- 23시 이후 출생은 기본 야자시(당일 일주 유지, 시간은 익일 일간 기준). 고급 설정에서 정자시(익일 일주)로 바꿀 수 있습니다.
- 대운수는 절입일까지의 날짜 ÷ 3(반올림), 양남음녀 순행. 신강약과 용신은 간이 억부 기준입니다.

## AI 심층 풀이

기본 풀이는 규칙 기반이라 키 없이 동작합니다. AI 풀이(Claude `claude-opus-5`)는 두 방식 중 하나로 연결합니다.

1. **프록시(권장, 서비스 운영용)**: `worker/anthropic-proxy.js`를 Cloudflare Workers에 배포하고 `ANTHROPIC_API_KEY`를 시크릿으로, `ALLOWED_ORIGIN`에 사이트 주소를 넣습니다. 앱 설정에서 Worker 주소를 입력합니다.
   ```
   cd saju/worker
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler deploy
   ```
2. **API 키 직접(개인 테스트용)**: 설정 화면에 키를 넣으면 브라우저에서 바로 호출합니다. 키가 기기에 저장되므로 운영에는 쓰지 마세요.

요청에는 서버측 refusal 폴백(`fallbacks: "default"`)이 켜져 있고, 캐릭터 페르소나는 prompt caching 대상입니다.

## 테스트

```
cd saju && npm test
```

## 로컬 실행

```
cd bobae-briefing && python3 -m http.server 8765
# http://localhost:8765/saju/
```
