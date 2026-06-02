# Server sharing with Caddy

SCOPELIST public client links use private slugs:

```text
https://domain.ru/p/<shareSlug>
```

Caddy should not be configured per proposal or per slug. Proxy the whole domain to
the Next.js app, then the app checks whether the slug exists, is published, has
not expired, and requires a password.

Minimal Caddyfile:

```caddyfile
domain.ru {
  encode gzip zstd
  reverse_proxy 127.0.0.1:3004
}
```

If Docker Compose exposes another host port through `APP_PORT`, proxy to that
port instead. Keep `PROPOSAL_PUBLIC_ORIGIN=https://domain.ru` in production so
admin UI copies canonical `/p/<shareSlug>` links.
