#!/usr/bin/env python3
"""액세스 토큰이 언제 만료되는지 확인한다.

장기 토큰도 60일이면 끝난다. 조용히 끊기면 업로드가 멈춘 걸 며칠 뒤에나
알게 되므로, 주 1회 미리 물어보고 얼마 안 남았으면 0이 아닌 값으로 끝낸다.

    python3 insta/check_token.py --warn-days 14
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def get(url: str, params: dict) -> dict:
    query = urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(f"{url}?{query}", timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode(errors="replace")
        try:
            message = json.loads(raw)["error"]["message"]
        except (json.JSONDecodeError, KeyError):
            message = raw[:300]
        raise SystemExit(f"✗ 토큰이 이미 못 쓰는 상태다 — {message}")
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SystemExit(f"✗ 확인 실패 (네트워크): {exc}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--warn-days", type=int, default=14,
                    help="남은 날이 이보다 적으면 실패로 처리한다 (기본 14)")
    args = ap.parse_args()

    token = os.environ.get("IG_ACCESS_TOKEN", "").strip()
    if not token:
        print("✗ IG_ACCESS_TOKEN 이 비어 있다", file=sys.stderr)
        return 1

    base = os.environ.get("IG_API_BASE", "https://graph.facebook.com").rstrip("/")
    version = os.environ.get("IG_API_VERSION", "v21.0")

    # 토큰이 살아 있는지부터. 죽었으면 여기서 SystemExit 로 끝난다.
    me = get(f"{base}/{version}/me", {"fields": "id", "access_token": token})

    data = get(f"{base}/debug_token",
               {"input_token": token, "access_token": token}).get("data", {})
    expires = data.get("expires_at", 0)

    if not expires:  # 0 이면 만료 없는 토큰 (시스템 사용자 토큰 등)
        print(f"✓ 토큰 정상 (id {me.get('id', '?')}) — 만료 없음")
        return 0

    when = datetime.fromtimestamp(expires, KST)
    left = (when - datetime.now(KST)).days
    print(f"토큰 만료: {when:%Y-%m-%d %H:%M} KST — {left}일 남음")

    if left <= args.warn_days:
        print(f"✗ {args.warn_days}일 이내에 만료된다. "
              "insta/README.md 의 '토큰 갱신' 대로 새로 발급해서 "
              "IG_ACCESS_TOKEN 시크릿을 바꿔라.", file=sys.stderr)
        return 1

    print("✓ 여유 있음")
    return 0


if __name__ == "__main__":
    sys.exit(main())
