/**
 * Resolves a URL, converting relative paths to absolute using the current origin.
 * Useful for proxied APIs in development.
 */
export function resolveUrl(url: string): string {
  if (url.startsWith('/')) {
    return `${window.location.origin}${url}`;
  }
  return url;
}
