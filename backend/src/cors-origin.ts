/**
 * Purpose: Checks whether an incoming browser origin is allowed by the API.
 */
const LOOPBACK_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;

/** Checks whether is allowed origin. */
export function isAllowedOrigin(origin: string | undefined): boolean {
  return origin === undefined || LOOPBACK_ORIGIN.test(origin);
}
