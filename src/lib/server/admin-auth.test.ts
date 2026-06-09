import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_ACCESS_COOKIE_NAME,
  ADMIN_ACCESS_MAX_AGE_SECONDS,
  createAdminAccessToken,
  getAdminAuthStatus,
  hasValidAdminAccessToken,
  isAdminRequestAuthorized,
  sanitizeAdminNextPath,
} from "./admin-auth.ts";

test("admin auth is disabled outside production when token is absent", () => {
  withAdminEnv({ nodeEnv: "test", token: undefined }, () => {
    assert.equal(getAdminAuthStatus(), "disabled");
    assert.equal(isAdminRequestAuthorized(new Request("https://example.test")), true);
  });
});

test("admin auth is misconfigured in production when token is absent", () => {
  withAdminEnv({ nodeEnv: "production", token: undefined }, () => {
    assert.equal(getAdminAuthStatus(), "misconfigured");
    assert.equal(isAdminRequestAuthorized(new Request("https://example.test")), false);
  });
});

test("admin request accepts configured header token", () => {
  withAdminEnv({ nodeEnv: "production", token: "secret-key" }, () => {
    const request = new Request("https://example.test/api/items/id/share", {
      headers: {
        "x-scopelist-admin-token": "secret-key",
      },
    });

    assert.equal(isAdminRequestAuthorized(request), true);
  });
});

test("admin request accepts signed access cookie", () => {
  withAdminEnv({ nodeEnv: "production", token: "secret-key" }, () => {
    const token = createAdminAccessToken();
    const request = new Request("https://example.test/lists/id/edit", {
      headers: {
        cookie: `${ADMIN_ACCESS_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
    });

    assert.equal(isAdminRequestAuthorized(request), true);
  });
});

test("admin access token rejects expired signatures", () => {
  withAdminEnv({ nodeEnv: "production", token: "secret-key" }, () => {
    const issuedAtMs = Date.UTC(2026, 0, 1);
    const token = createAdminAccessToken(issuedAtMs);
    const expiredNowMs =
      issuedAtMs + (ADMIN_ACCESS_MAX_AGE_SECONDS + 1) * 1000;

    assert.equal(hasValidAdminAccessToken(token, expiredNowMs), false);
  });
});

test("sanitizeAdminNextPath only keeps admin routes", () => {
  assert.equal(sanitizeAdminNextPath("/"), "/");
  assert.equal(sanitizeAdminNextPath("/lists/new"), "/lists/new");
  assert.equal(sanitizeAdminNextPath("/lists/abc/edit"), "/lists/abc/edit");
  assert.equal(sanitizeAdminNextPath("/p/client"), "/");
  assert.equal(sanitizeAdminNextPath("//evil.test"), "/");
  assert.equal(sanitizeAdminNextPath("https://evil.test"), "/");
});

function withAdminEnv(
  env: { nodeEnv: string; token: string | undefined },
  run: () => void,
) {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalToken = process.env.ADMIN_ACCESS_TOKEN;

  process.env.NODE_ENV = env.nodeEnv;
  restoreEnv("ADMIN_ACCESS_TOKEN", env.token);

  try {
    run();
  } finally {
    restoreEnv("NODE_ENV", originalNodeEnv);
    restoreEnv("ADMIN_ACCESS_TOKEN", originalToken);
  }
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
