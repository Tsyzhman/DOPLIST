import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_ACCESS_COOKIE_NAME,
  getAdminAuthStatus,
  hasValidAdminAccessToken,
  sanitizeAdminNextPath,
} from "./admin-auth";

export async function requireAdminAccess(nextPath: string) {
  if (await hasAdminCookieAccess()) {
    return;
  }

  redirect(`/login?next=${encodeURIComponent(sanitizeAdminNextPath(nextPath))}`);
}

export async function hasAdminCookieAccess() {
  const status = getAdminAuthStatus();

  if (status === "disabled") {
    return true;
  }

  if (status === "misconfigured") {
    return false;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_ACCESS_COOKIE_NAME)?.value;

  return hasValidAdminAccessToken(token);
}
