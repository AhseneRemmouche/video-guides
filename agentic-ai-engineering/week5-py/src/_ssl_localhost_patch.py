"""
Environment shim for THIS Windows machine only.

The bundled OpenSSL in the local Python build raises
`OPENSSL_Uplink(...): no OPENSSL_Applink` (a missing-applink build quirk) the
moment anything loads CA certificates -- e.g. `ssl.create_default_context()`,
`SSLContext.load_default_certs()` or `load_verify_locations()`. That makes even
creating an `httpx` client crash, because httpx eagerly builds a default
TLS context at construction time.

We only ever talk to a LOCAL Ollama server at `http://localhost:11434`, which
is plain HTTP -- no TLS handshake ever happens. So we neutralise *only* the
CA-cert-loading calls (which would otherwise crash at construction) and leave
everything else intact. A bare `SSLContext` constructs fine; it is simply never
used for a real handshake here.

Import this module FIRST, before importing httpx / ollama / autogen_ext.
This is a workaround for a broken local OpenSSL build, not something you'd ship.
"""

import ssl


def _noop(self, *args, **kwargs):  # pragma: no cover - trivial
    return None


def _create_unverified_context(*args, **kwargs):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


# Patch the cert-loading entry points that trigger the applink crash.
ssl.SSLContext.load_default_certs = _noop          # type: ignore[assignment]
ssl.SSLContext.load_verify_locations = _noop       # type: ignore[assignment]
ssl.create_default_context = _create_unverified_context  # type: ignore[assignment]
ssl._create_default_https_context = _create_unverified_context  # type: ignore[attr-defined]

APPLIED = True
