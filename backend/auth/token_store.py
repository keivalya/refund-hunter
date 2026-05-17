"""
In-memory token store — single-user, demo-scope only.

INTENTIONAL DESIGN: We store tokens in a Python dict that resets on server
restart. This is a hackathon demo — no Supabase, no files, no persistence.
A production version would use encrypted storage with per-user keys.
"""

_store: dict = {}


def save_tokens(email: str, access_token: str, refresh_token: str | None) -> None:
    _store["email"] = email
    _store["access_token"] = access_token
    _store["refresh_token"] = refresh_token


def get_tokens() -> dict | None:
    if "access_token" not in _store:
        return None
    return dict(_store)


def is_connected() -> bool:
    return "access_token" in _store
