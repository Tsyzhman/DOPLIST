import { timingSafeEqual } from "crypto";

export function isAdminRequestAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_ACCESS_TOKEN;

  if (!expected) {
    return true;
  }

  const provided = request.headers.get("x-scopelist-admin-token") || "";
  const actualBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
