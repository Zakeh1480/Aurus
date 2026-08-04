"""Formatação de datetime compatível com o lado TS (z.iso.datetime() / Date.toISOString())."""

from datetime import datetime, timezone


def to_iso_z(dt: datetime) -> str:
    """Formata um datetime como string ISO-8601 UTC com milissegundos e sufixo 'Z'.

    Datetimes sem timezone são tratados como UTC. Usa sufixo literal 'Z' (não
    '+00:00') para bater exatamente com o formato de `Date.prototype.toISOString()`
    do JS, que é o que o Zod `z.iso.datetime()` normalmente valida.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def utc_now_iso() -> str:
    return to_iso_z(datetime.now(timezone.utc))
