# Server sharing with Caddy

SCOPELIST public client links use private slugs:

```text
https://domain.ru/p/<shareSlug>
```

Caddy should not be configured per proposal or per slug. Proxy the whole domain to
the Next.js app, then the app checks whether the slug exists, is published, has
not expired, and requires a password.

Recommended Caddyfile:

```caddyfile
domain.ru {
  encode gzip zstd

  # Public client-facing paths stay open.
  @public path /p/* /api/public/* /api/public-events
  handle @public {
    reverse_proxy 127.0.0.1:3004
  }

  # Builder and admin write APIs are protected at the proxy layer.
  handle {
    basic_auth {
      # Generate with:
      # caddy hash-password --plaintext 'strong-password'
      admin <bcrypt-hash>
    }
    reverse_proxy 127.0.0.1:3004
  }
}
```

If Docker Compose exposes another host port through `APP_PORT`, proxy to that
port instead. Keep `PROPOSAL_PUBLIC_ORIGIN=https://domain.ru` in production so
admin UI copies canonical `/p/<shareSlug>` links.

The app also supports optional defense-in-depth for direct server/CLI calls:
when `ADMIN_ACCESS_TOKEN` is set, `POST /api/items/*/share` requires a matching
`x-scopelist-admin-token` header. Do not expose this token to browser code; the
browser builder should rely on Caddy basic auth.
