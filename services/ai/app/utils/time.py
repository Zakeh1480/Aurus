from datetime import datetime, timezone


def to_iso_z(dt: datetime) -> str:

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def utc_now_iso() -> str:
    return to_iso_z(datetime.now(timezone.utc))
