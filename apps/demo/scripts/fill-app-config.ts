// The runtime-config substitution, kept apart from the CLI so it stays pure and any
// other filler uses it rather than a second spelling. In scripts/, never bundled.

export const APP_CONFIG_PLACEHOLDER = '@@APP_CONFIG@@';

// JSON.stringify emits < and & verbatim, so a value carrying </script> would close
// the inline script tag. The \uXXXX forms parse identically and the tokenizer
// ignores them. U+2028 and U+2029 end a line for older JS parsers.
const HTML_UNSAFE = /[<>&\u2028\u2029]/g;

function htmlSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(HTML_UNSAFE, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Inlines `config` into `html`'s placeholder. Throws when the placeholder is absent. */
export function fillAppConfig(html: string, config: unknown): string {
  if (!html.includes(APP_CONFIG_PLACEHOLDER)) {
    throw new Error(`has no ${APP_CONFIG_PLACEHOLDER} placeholder, so the app config cannot be inlined.`);
  }
  const json = htmlSafeJson(config);
  // A function replacement, since a string one expands $&, $` and $'. replaceAll so
  // a page carrying the token twice cannot ship one filled copy and one raw.
  return html.replaceAll(APP_CONFIG_PLACEHOLDER, () => json);
}
