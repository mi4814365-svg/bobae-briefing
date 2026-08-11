#!/usr/bin/env python3
"""인스타그램 자동 업로드.

insta/queue/*.json 에 예약해 둔 글 중에서 발행 시각이 지난 것을 골라
인스타그램 그래프 API로 올린다. 성공하면 insta/published/ 로 옮기고
log.jsonl 에 한 줄 남긴다.

의존성 없음 — 표준 라이브러리만 쓴다. (러너에서 pip install 이 필요 없다)

    python3 insta/publish.py --validate      # 큐 문법만 검사 (네트워크 안 씀)
    python3 insta/publish.py --dry-run       # 올릴 것만 보여주고 멈춤
    python3 insta/publish.py                 # 실제 발행
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

KST = timezone(timedelta(hours=9))

ROOT = Path(__file__).resolve().parent
QUEUE_DIR = ROOT / "queue"
PUBLISHED_DIR = ROOT / "published"
FAILED_DIR = ROOT / "failed"
LOG_PATH = PUBLISHED_DIR / "log.jsonl"

# 인스타그램이 정한 한계. 넘으면 API가 거절하므로 올리기 전에 걸러낸다.
CAPTION_MAX = 2200
HASHTAG_MAX = 30
CAROUSEL_MIN, CAROUSEL_MAX = 2, 10

VALID_TYPES = {"image", "carousel", "reel", "story"}

# 영상은 인코딩이 끝나야 발행할 수 있다. 그동안 컨테이너 상태를 되묻는다.
POLL_INTERVAL = 8
POLL_TIMEOUT = 600


class PublishError(RuntimeError):
    """올리기를 포기해야 하는 상황. 메시지가 그대로 로그에 남는다."""


# ── 설정 ────────────────────────────────────────────────────────────────

class Config:
    def __init__(self) -> None:
        self.user_id = os.environ.get("IG_USER_ID", "").strip()
        self.token = os.environ.get("IG_ACCESS_TOKEN", "").strip()
        self.api_base = os.environ.get(
            "IG_API_BASE", "https://graph.facebook.com"
        ).rstrip("/")
        self.api_version = os.environ.get("IG_API_VERSION", "v21.0").strip()
        # 저장소 안의 이미지를 쓸 때, 인스타가 받아갈 수 있는 공개 주소의 앞부분.
        self.media_base = os.environ.get("IG_MEDIA_BASE_URL", "").rstrip("/")

    def require(self) -> None:
        missing = [
            name
            for name, value in (("IG_USER_ID", self.user_id), ("IG_ACCESS_TOKEN", self.token))
            if not value
        ]
        if missing:
            raise PublishError(
                f"환경변수가 비어 있다: {', '.join(missing)}. "
                "insta/README.md 의 '깃허브 시크릿' 항목을 보라."
            )

    def endpoint(self, path: str) -> str:
        return f"{self.api_base}/{self.api_version}/{path.lstrip('/')}"


# ── HTTP ────────────────────────────────────────────────────────────────

def _request(method: str, url: str, params: dict, *, retries: int = 3) -> dict:
    """그래프 API 한 번 호출. 5xx·네트워크 오류만 물러섰다가 다시 시도한다."""
    body = urllib.parse.urlencode(
        {k: v for k, v in params.items() if v is not None}
    ).encode()

    for attempt in range(retries):
        try:
            if method == "GET":
                req = urllib.request.Request(f"{url}?{body.decode()}", method="GET")
            else:
                req = urllib.request.Request(url, data=body, method="POST")
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode(errors="replace")
            # 4xx는 우리가 잘못 보낸 것이다. 다시 보내봐야 같은 답이 온다.
            if exc.code < 500 or attempt == retries - 1:
                raise PublishError(f"API {exc.code}: {_explain(raw)}") from None
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == retries - 1:
                raise PublishError(f"네트워크 실패: {exc}") from None
        time.sleep(2 ** attempt)

    raise PublishError("재시도를 다 썼다")  # 도달하지 않음


def _explain(raw: str) -> str:
    """그래프 API의 오류 덩어리에서 사람이 읽을 부분만 꺼낸다."""
    try:
        err = json.loads(raw).get("error", {})
    except json.JSONDecodeError:
        return raw[:400]
    parts = [err.get("message", "")]
    if err.get("error_user_msg"):
        parts.append(err["error_user_msg"])
    if err.get("code"):
        parts.append(f"(code {err['code']}"
                     + (f"/{err['error_subcode']}" if err.get("error_subcode") else "")
                     + ")")
    return " ".join(p for p in parts if p) or raw[:400]


# ── 큐 읽기 ─────────────────────────────────────────────────────────────

def parse_when(value: str) -> datetime:
    """예약 시각을 읽는다. 시간대를 안 쓰면 한국 시간으로 본다."""
    text = str(value).strip().replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S%z", "%Y-%m-%d %H:%M%z",
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(text, fmt)
        except ValueError:
            continue
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=KST)
    raise PublishError(f"publish_at 을 못 읽겠다: {value!r} (예: 2026-08-12 09:00)")


def resolve_media(ref: str, cfg: Config) -> str:
    """이미지·영상 참조를 인스타가 받아갈 공개 URL로 바꾼다."""
    ref = str(ref).strip()
    if ref.startswith(("http://", "https://")):
        return ref
    if not cfg.media_base:
        raise PublishError(
            f"{ref!r} 은 저장소 안 경로인데 IG_MEDIA_BASE_URL 이 안 잡혀 있다. "
            "인스타는 공개된 주소에서만 파일을 받아간다."
        )
    return f"{cfg.media_base}/{ref.lstrip('/')}"


def is_video(url: str) -> bool:
    return url.lower().rsplit("?", 1)[0].endswith((".mp4", ".mov"))


def check_local_media(post: dict, path: Path) -> list[str]:
    """저장소 안 경로로 적은 파일이 실제로 있는지 본다."""
    problems = []
    media = post.get("media") if isinstance(post.get("media"), list) else []
    for ref in media + ([post["cover"]] if post.get("cover") else []):
        ref = str(ref)
        if ref.startswith(("http://", "https://")):
            continue
        if not (ROOT / ref).exists():
            problems.append(f"{path.name}: 파일이 없다 — insta/{ref}")
    return problems


def validate(post: dict, path: Path) -> list[str]:
    """올리기 전에 걸러낼 수 있는 문제를 모아 돌려준다."""
    problems = []
    name = path.name

    kind = post.get("type", "image")
    if kind not in VALID_TYPES:
        problems.append(f"{name}: type 이 {kind!r} — {'/'.join(sorted(VALID_TYPES))} 중 하나여야 한다")

    if not post.get("publish_at"):
        # 초안은 날짜를 아직 안 정했을 수 있다. 발행 대상이 될 때만 따진다.
        if not post.get("draft"):
            problems.append(f"{name}: publish_at 이 없다")
    else:
        try:
            parse_when(post["publish_at"])
        except PublishError as exc:
            problems.append(f"{name}: {exc}")

    media = post.get("media") or []
    if not isinstance(media, list) or not media:
        problems.append(f"{name}: media 가 비어 있다")
    elif kind == "carousel" and not CAROUSEL_MIN <= len(media) <= CAROUSEL_MAX:
        problems.append(f"{name}: 캐러셀은 {CAROUSEL_MIN}~{CAROUSEL_MAX}장인데 {len(media)}장이다")
    elif kind in {"image", "reel", "story"} and len(media) != 1:
        problems.append(f"{name}: {kind} 는 파일이 하나여야 하는데 {len(media)}개다")

    caption = post.get("caption", "") or ""
    if len(caption) > CAPTION_MAX:
        problems.append(f"{name}: 캡션이 {len(caption)}자 — {CAPTION_MAX}자까지다")
    tags = re.findall(r"#[^\s#]+", caption)
    if len(tags) > HASHTAG_MAX:
        problems.append(f"{name}: 해시태그가 {len(tags)}개 — {HASHTAG_MAX}개까지다")

    if kind == "story" and caption:
        problems.append(f"{name}: 스토리에는 캡션을 붙일 수 없다")

    # 초안은 사진을 아직 안 넣었을 수 있으니 파일 존재는 안 따진다.
    if not post.get("draft"):
        problems.extend(check_local_media(post, path))
    return problems


def load_queue() -> list[tuple[Path, dict]]:
    items = []
    for path in sorted(QUEUE_DIR.glob("*.json")):
        try:
            post = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise PublishError(f"{path.name}: JSON 문법 오류 — {exc}") from None
        items.append((path, post))
    return items


# ── 발행 ────────────────────────────────────────────────────────────────

def create_container(cfg: Config, params: dict) -> str:
    result = _request("POST", cfg.endpoint(f"{cfg.user_id}/media"),
                      {**params, "access_token": cfg.token})
    if "id" not in result:
        raise PublishError(f"컨테이너 id 가 안 왔다: {result}")
    return result["id"]


def wait_ready(cfg: Config, container_id: str) -> None:
    """영상·캐러셀은 인코딩이 끝나야 발행된다. FINISHED 가 될 때까지 기다린다."""
    deadline = time.monotonic() + POLL_TIMEOUT
    while True:
        status = _request("GET", cfg.endpoint(container_id),
                          {"fields": "status_code,status", "access_token": cfg.token})
        code = status.get("status_code")
        if code == "FINISHED":
            return
        if code in {"ERROR", "EXPIRED"}:
            raise PublishError(f"컨테이너 {code}: {status.get('status', '사유 없음')}")
        if time.monotonic() > deadline:
            raise PublishError(f"{POLL_TIMEOUT}초 안에 인코딩이 안 끝났다 (상태: {code})")
        time.sleep(POLL_INTERVAL)


def build_container(cfg: Config, post: dict) -> str:
    """글 하나를 발행 직전 상태의 컨테이너로 만든다."""
    kind = post.get("type", "image")
    media = [resolve_media(m, cfg) for m in post["media"]]
    caption = post.get("caption", "")

    if kind == "image":
        container = create_container(cfg, {
            "image_url": media[0],
            "caption": caption,
            "alt_text": post.get("alt_text"),
            "location_id": post.get("location_id"),
        })

    elif kind == "story":
        container = create_container(cfg, {
            "media_type": "STORIES",
            **({"video_url": media[0]} if is_video(media[0]) else {"image_url": media[0]}),
        })
        if is_video(media[0]):
            wait_ready(cfg, container)

    elif kind == "reel":
        container = create_container(cfg, {
            "media_type": "REELS",
            "video_url": media[0],
            "caption": caption,
            "cover_url": resolve_media(post["cover"], cfg) if post.get("cover") else None,
            "share_to_feed": "true" if post.get("share_to_feed", True) else "false",
            "location_id": post.get("location_id"),
        })
        wait_ready(cfg, container)

    elif kind == "carousel":
        children = []
        for url in media:
            # 캐러셀 낱장은 각각 컨테이너로 만든 뒤 하나로 묶는다.
            video = is_video(url)
            child = create_container(cfg, {
                "is_carousel_item": "true",
                **({"media_type": "VIDEO", "video_url": url} if video
                   else {"image_url": url}),
            })
            if video:
                wait_ready(cfg, child)
            children.append(child)
        container = create_container(cfg, {
            "media_type": "CAROUSEL",
            "children": ",".join(children),
            "caption": caption,
            "location_id": post.get("location_id"),
        })
        wait_ready(cfg, container)

    else:
        raise PublishError(f"모르는 type: {kind}")

    return container


def publish(cfg: Config, container_id: str) -> str:
    result = _request("POST", cfg.endpoint(f"{cfg.user_id}/media_publish"),
                      {"creation_id": container_id, "access_token": cfg.token})
    if "id" not in result:
        raise PublishError(f"발행 응답에 id 가 없다: {result}")
    return result["id"]


def remaining_quota(cfg: Config) -> int | None:
    """24시간 안에 몇 개 더 올릴 수 있는지. 못 알아내면 None."""
    try:
        result = _request("GET", cfg.endpoint(f"{cfg.user_id}/content_publishing_limit"),
                          {"fields": "config,quota_usage", "access_token": cfg.token},
                          retries=1)
        row = (result.get("data") or [{}])[0]
        return int(row.get("config", {}).get("quota_total", 50)) - int(row.get("quota_usage", 0))
    except (PublishError, ValueError, KeyError, IndexError):
        return None


# ── 기록 ────────────────────────────────────────────────────────────────

def record(entry: dict) -> None:
    PUBLISHED_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(entry, ensure_ascii=False) + "\n")


def archive(path: Path, dest_dir: Path, post: dict) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / path.name
    if dest.exists():  # 같은 이름이 이미 있으면 덮어쓰지 않는다
        dest = dest_dir / f"{path.stem}-{int(time.time())}{path.suffix}"
    dest.write_text(json.dumps(post, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    path.unlink()


def defer(path: Path, post: dict, error: str, max_attempts: int) -> bool:
    """실패한 글의 시도 횟수를 올린다. 한도를 넘으면 failed/ 로 뺀다."""
    post["_attempts"] = int(post.get("_attempts", 0)) + 1
    post["_last_error"] = error
    if post["_attempts"] >= max_attempts:
        archive(path, FAILED_DIR, post)
        return True
    path.write_text(json.dumps(post, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return False


# ── 실행 ────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description="예약된 인스타그램 글을 올린다")
    ap.add_argument("--validate", action="store_true", help="큐 문법만 검사한다")
    ap.add_argument("--dry-run", action="store_true", help="올릴 목록만 보고 멈춘다")
    ap.add_argument("--limit", type=int, default=5, help="한 번에 올릴 최대 개수 (기본 5)")
    ap.add_argument("--max-attempts", type=int, default=3,
                    help="이만큼 실패하면 failed/ 로 뺀다 (기본 3)")
    args = ap.parse_args()

    if not QUEUE_DIR.exists():
        print("insta/queue 가 없다. 올릴 것이 없다.")
        return 0

    try:
        queue = load_queue()
    except PublishError as exc:
        print(f"✗ {exc}", file=sys.stderr)
        return 1

    problems = [p for path, post in queue for p in validate(post, path)]
    if problems:
        print("큐에 문제가 있다:", file=sys.stderr)
        for line in problems:
            print(f"  ✗ {line}", file=sys.stderr)
        return 1

    if args.validate:
        print(f"✓ 큐 {len(queue)}건, 문제 없음")
        return 0

    now = datetime.now(KST)
    live = [(path, post) for path, post in queue if not post.get("draft")]
    due = sorted(
        ((path, post) for path, post in live if parse_when(post["publish_at"]) <= now),
        key=lambda item: parse_when(item[1]["publish_at"]),
    )

    if not due:
        upcoming = sorted(parse_when(p["publish_at"]) for _, p in live)
        nxt = f" (다음: {upcoming[0]:%Y-%m-%d %H:%M} KST)" if upcoming else ""
        print(f"지금 올릴 글이 없다. 대기 {len(live)}건{nxt}")
        return 0

    cfg = Config()
    try:
        cfg.require()
    except PublishError as exc:
        print(f"✗ {exc}", file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"[모의 실행] {len(due)}건이 올라갈 예정:")
        for path, post in due[: args.limit]:
            print(f"  · {path.name} — {post.get('type', 'image')} — "
                  f"{(post.get('caption') or '(캡션 없음)').splitlines()[0][:60]}")
        return 0

    quota = remaining_quota(cfg)
    batch = due[: args.limit]
    if quota is not None and quota < len(batch):
        print(f"! 24시간 발행 한도가 {quota}건 남았다. {len(batch)}건 중 {max(quota, 0)}건만 올린다.")
        batch = batch[: max(quota, 0)]

    published = failures = 0
    for path, post in batch:
        label = f"{path.name} ({post.get('type', 'image')})"
        try:
            media_id = publish(cfg, build_container(cfg, post))
        except PublishError as exc:
            failures += 1
            dropped = defer(path, post, str(exc), args.max_attempts)
            where = "failed/ 로 옮겼다" if dropped else f"{post['_attempts']}번째 실패, 다음에 다시 시도한다"
            print(f"✗ {label}: {exc} — {where}", file=sys.stderr)
            continue

        published += 1
        entry = {
            "file": path.name,
            "media_id": media_id,
            "type": post.get("type", "image"),
            "published_at": datetime.now(KST).isoformat(timespec="seconds"),
            "scheduled_for": post["publish_at"],
        }
        record(entry)
        archive(path, PUBLISHED_DIR, {**post, "_published": entry})
        print(f"✓ {label} → media {media_id}")

    waiting = sum(1 for _, post in load_queue() if not post.get("draft"))
    print(f"\n올림 {published}건 / 실패 {failures}건 / 남은 대기 {waiting}건")
    return 1 if failures and not published else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
