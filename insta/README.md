# 인스타그램 자동 업로드

`insta/queue/` 에 글을 하나씩 넣어두면, 깃허브 액션이 매시간 돌면서
발행 시각이 지난 것을 인스타그램에 올린다. 올라간 글은 `insta/published/` 로
옮겨지고 `published/log.jsonl` 에 기록이 남는다.

```
insta/
  publish.py          업로드 스크립트 (표준 라이브러리만 씀)
  check_token.py      토큰 만료 확인
  queue/              올릴 글 — 여기에 넣는다
  media/              저장소에 같이 두는 사진·영상
  published/          올라간 글 + log.jsonl
  failed/             3번 실패해서 빠진 글
```

---

## 1. 계정 준비 (사람이 직접 해야 하는 부분)

인스타그램은 **API로 계정을 새로 만들 수 없다.** 계정 생성은 앱에서 직접
하고, 아래 상태로 맞춰 놓아야 자동 업로드가 열린다.

1. **인스타그램 계정 생성** — 앱에서 만든다. 업로드 전용으로 새로 파도 되고,
   쓰던 계정을 써도 된다.
2. **프로페셔널 계정으로 전환** — 설정 → 계정 유형 → 프로페셔널 전환 →
   **비즈니스** 선택. (개인 계정에는 발행 API가 열리지 않는다)
3. **페이스북 페이지 연결** — 인스타 설정 → 페이지 연결. 페이지가 없으면
   새로 만든다. 이 연결이 없으면 3번 방식의 토큰이 안 나온다.

> 페이스북 페이지를 두기 싫다면 "Instagram 로그인" 방식도 있다.
> 그때는 저장소 변수 `IG_API_BASE` 를 `https://graph.instagram.com` 으로
> 바꾸면 이 스크립트가 그대로 동작한다.

---

## 2. 앱과 토큰 만들기

1. [developers.facebook.com](https://developers.facebook.com/apps) → **앱 만들기**
   → 유형 **비즈니스** → 제품에서 **Instagram** 추가.
2. 앱 설정 → 역할에 본인 계정이 관리자로 들어가 있는지 확인한다.
   자기 소유 계정에 올리는 것은 앱 검수(App Review) 없이도 된다.
3. **그래프 API 탐색기**에서 위 앱을 고르고, 아래 권한으로 사용자 토큰을 받는다.

   ```
   instagram_basic
   instagram_content_publish
   pages_show_list
   pages_read_engagement
   business_management
   ```

4. **장기 토큰으로 바꾼다.** 탐색기에서 받은 토큰은 1~2시간이면 죽는다.

   ```bash
   curl -s "https://graph.facebook.com/v21.0/oauth/access_token\
   ?grant_type=fb_exchange_token\
   &client_id=<앱 ID>\
   &client_secret=<앱 시크릿>\
   &fb_exchange_token=<짧은 토큰>"
   ```

   나오는 `access_token` 이 60일짜리다. 이것을 쓴다.

5. **인스타 사용자 ID를 찾는다.**

   ```bash
   # 페이지 목록
   curl -s "https://graph.facebook.com/v21.0/me/accounts?access_token=<장기 토큰>"

   # 그 페이지에 붙은 인스타 계정
   curl -s "https://graph.facebook.com/v21.0/<페이지 ID>\
   ?fields=instagram_business_account&access_token=<장기 토큰>"
   ```

   `instagram_business_account.id` 가 `IG_USER_ID` 다.

---

## 3. 깃허브 시크릿

저장소 → Settings → Secrets and variables → Actions.

**Secrets** (필수)

| 이름 | 값 |
| --- | --- |
| `IG_USER_ID` | 위에서 찾은 인스타 비즈니스 계정 ID |
| `IG_ACCESS_TOKEN` | 60일짜리 장기 토큰 |

**Variables** (선택)

| 이름 | 기본값 | 언제 바꾸나 |
| --- | --- | --- |
| `IG_MEDIA_BASE_URL` | 이 저장소의 raw 주소 | 저장소가 비공개라 사진을 다른 곳에 둘 때 |
| `IG_API_BASE` | `https://graph.facebook.com` | 페이스북 페이지 없이 갈 때 |
| `IG_API_VERSION` | `v21.0` | 메타가 버전을 내릴 때 |

> **비공개 저장소면 `IG_MEDIA_BASE_URL` 을 반드시 잡아야 한다.** 인스타는
> 사진을 자기가 직접 받아가므로, 로그인 없이 열리는 주소여야 한다.
> 깃허브 페이지, S3, 클라우드플레어 R2 어디든 된다.

---

## 4. 글 넣기

`insta/queue/` 에 JSON 파일 하나가 게시물 하나다. 파일명은 자유
(`2026-08-12-신메뉴.json` 처럼 날짜를 앞에 두면 보기 편하다).

```json
{
  "type": "image",
  "publish_at": "2026-08-12 09:00",
  "caption": "오늘의 한 컷.\n\n#보배에프앤비 #맛집",
  "media": ["media/2026-08-12-menu.jpg"],
  "alt_text": "접시에 담긴 요리 사진"
}
```

| 항목 | 설명 |
| --- | --- |
| `type` | `image` · `carousel` · `reel` · `story` (기본 `image`) |
| `publish_at` | **한국 시간**. `2026-08-12 09:00` 또는 `2026-08-12` |
| `caption` | 2200자, 해시태그 30개까지. 스토리에는 못 붙인다 |
| `media` | `media/` 아래 상대경로 또는 `https://` 주소. 캐러셀은 2~10개 |
| `cover` | 릴스 표지 (선택) |
| `share_to_feed` | 릴스를 피드에도 띄울지 (기본 `true`) |
| `alt_text` | 대체 텍스트 (선택) |
| `location_id` | 페이스북 장소 ID (선택) |
| `draft` | `true` 면 시각이 지나도 안 올라간다 |

사진은 `insta/media/` 에 같이 커밋한다. **JPEG**, 8MB 이하, 가로세로 비율
4:5 ~ 1.91:1. 릴스는 MP4/MOV, 1GB·15분 이하.

발행 시각이 이미 지난 글을 넣으면 **다음 회차에 바로 올라간다.** 예약이
아니라 즉시 올리고 싶을 때 이 성질을 쓰면 된다.

---

## 5. 확인하고 돌리기

```bash
python3 insta/publish.py --validate    # 문법·파일 존재만 검사 (네트워크 안 씀)
python3 insta/publish.py --dry-run     # 무엇이 올라갈지만 본다
python3 insta/publish.py --limit 1     # 실제로 하나만 올린다
```

액션 탭 → **인스타 자동 업로드** → Run workflow 로 손수 돌릴 수도 있고,
`dry_run` 을 켜면 올리지 않고 대상만 확인한다.

푸시·PR 때는 **인스타 점검** 워크플로가 큐 문법을 자동으로 검사한다.

---

## 6. 토큰 갱신 (60일마다)

장기 토큰도 60일이면 끊긴다. 매주 월요일 아침 **인스타 점검** 워크플로가
만료를 확인하고, 14일 이내로 남으면 **실패로 표시해서 알려준다.**

갱신은 2번의 3~4단계를 다시 하면 된다. 새 토큰으로 `IG_ACCESS_TOKEN`
시크릿만 바꿔 넣으면 끝이다.

끊긴 줄 모르고 지나가지 않도록, 저장소 → Settings → Notifications 에서
액션 실패 알림을 켜두는 편이 낫다.

---

## 알아둘 제약

- **하루 50개**까지만 발행된다. 한도가 모자라면 스크립트가 남은 만큼만 올리고
  나머지는 큐에 둔다.
- 인스타 API로는 **일반 게시물·릴스·스토리**만 올라간다. 라이브, 공동 작업자
  태그 등은 안 된다.
- 실패한 글은 3번까지 다시 시도하고, 그 뒤 `insta/failed/` 로 빠진다.
  파일 안의 `_last_error` 에 이유가 적혀 있다.
- 깃허브 크론은 정시보다 **5~15분 늦게** 도는 일이 흔하다. 분 단위로 정확한
  발행이 필요하면 이 방식은 맞지 않는다.
