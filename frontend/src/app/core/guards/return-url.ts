const PLACEHOLDER_ORIGIN = 'http://return-url.invalid';

/**
 * Accepts a return address only when it is a path on this origin. Anything else (another
 * host, a protocol-relative `//host`, a backslash trick, a script scheme) is refused, because
 * following a user-controlled address after sign-in is an open redirect.
 */
export function sanitizeReturnUrl(candidate: string | null | undefined): string | null {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return null;
  }
  if (candidate.includes('\\') || /[\u0000-\u001f]/.test(candidate)) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.origin !== PLACEHOLDER_ORIGIN || parsed.pathname.startsWith('/sign-in')) {
    return null;
  }

  return parsed.pathname + parsed.search + parsed.hash;
}
