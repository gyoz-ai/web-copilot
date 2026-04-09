/** Platform detection utilities. */

let _isSafariMobile: boolean | null = null;

/** Returns true on Safari iOS / iPadOS (not macOS Safari). */
export function isSafariMobile(): boolean {
  if (_isSafariMobile !== null) return _isSafariMobile;
  const ua = navigator.userAgent;
  // iPad reports as "Macintosh" since iPadOS 13 — detect via touch + Safari UA
  const isIPad =
    /Macintosh/.test(ua) && "ontouchend" in document && /Safari/.test(ua);
  const isIPhone = /iPhone|iPod/.test(ua);
  _isSafariMobile = (isIPad || isIPhone) && !/CriOS|FxiOS|Chrome/.test(ua);
  return _isSafariMobile;
}
