import { describe, expect, it } from 'vitest';
import { APP_CONFIG_PLACEHOLDER, fillAppConfig } from '../scripts/fill-app-config';

const PAGE = `<script>window.__APP_CONFIG__ = ${APP_CONFIG_PLACEHOLDER};</script>`;

/** Characters the HTML tokenizer reacts to inside a script body, plus the two JS line separators. */
const HTML_UNSAFE = /[<>&\u2028\u2029]/;

// Config values that are hostile to inlining. One implementation fills the page
// for both the deploy and the dev server, so these run once, here, rather than
// being replayed against a second spelling of the same substitution.
const ADVERSARIAL_URLS: Record<string, string> = {
  'a closing script tag': 'https://ces.example/</script><img src=x onerror=alert(1)>',
  'an html comment that opens script-data-escaped state': 'https://ces.example/<!--<script>',
  'a regex replacement pattern': "https://ces.example/?a=$&b=$'c=$`d=$$e",
  'an ampersand': 'https://ces.example/a?x=1&y=2',
  'a backslash': 'https://ces.example/a\\b',
  'the js line separators': 'https://ces.example/a\u2028b\u2029c',
  // jq escapes this one and JSON.stringify leaves it raw, so the bash filler and
  // the JS filler used to emit different bytes here. One filler has one answer.
  'the delete control character': 'https://ces.example/a\u007fb',
};

/** The text the page assigns to window.__APP_CONFIG__, exactly as written. */
function inlinedText(html: string): string {
  const prefix = 'window.__APP_CONFIG__ = ';
  const start = html.indexOf(prefix);
  if (start === -1) {
    throw new Error(`no config assignment in: ${html}`);
  }
  const from = start + prefix.length;
  const end = html.indexOf(';</script>', from);
  if (end === -1) {
    throw new Error(`unterminated config assignment in: ${html}`);
  }
  return html.slice(from, end);
}

/** How many times a substring occurs. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Asserts the filled page inlined `config` in a form that is safe in an HTML
 * script context, that it parses back to the original value, and that it opened
 * no script tag the source page did not already have.
 */
function expectSafelyInlined(source: string, filled: string, config: unknown): void {
  const json = inlinedText(filled);
  expect(json).not.toMatch(HTML_UNSAFE);
  expect(JSON.parse(json)).toEqual(config);
  expect(count(filled, '</script>')).toBe(count(source, '</script>'));
}

describe('fillAppConfig', () => {
  it('inlines the config where the placeholder was', () => {
    const filled: string = fillAppConfig(PAGE, { networkId: 'preview' });
    expect(filled).not.toContain(APP_CONFIG_PLACEHOLDER);
    expect(JSON.parse(inlinedText(filled))).toEqual({ networkId: 'preview' });
  });

  it('leaves the rest of the page byte for byte alone', () => {
    const source = `<!doctype html>\n<body>\n<script>x = ${APP_CONFIG_PLACEHOLDER};</script>\n</body>\n`;
    expect(fillAppConfig(source, { networkId: 'preview' })).toBe(
      source.replace(APP_CONFIG_PLACEHOLDER, '{"networkId":"preview"}')
    );
  });

  // A page carrying the token twice must not ship one filled copy and one raw,
  // which is what String.replace would do.
  it('fills every occurrence, not just the first', () => {
    const source = `${PAGE}\n${PAGE}`;
    const filled: string = fillAppConfig(source, { networkId: 'mainnet' });
    expect(filled).not.toContain(APP_CONFIG_PLACEHOLDER);
    expect(count(filled, '{"networkId":"mainnet"}')).toBe(2);
  });

  it('fails loud when the placeholder is absent, rather than returning the page untouched', () => {
    expect(() => fillAppConfig('<script>window.__APP_CONFIG__ = {};</script>', { networkId: 'preview' })).toThrow(
      new RegExp(APP_CONFIG_PLACEHOLDER)
    );
  });

  it.each(Object.entries(ADVERSARIAL_URLS))('inlines a config value carrying %s safely', (_label, url) => {
    const config = { networkId: 'preview', capacityExchangeUrl: url };
    expectSafelyInlined(PAGE, fillAppConfig(PAGE, config), config);
  });

  // String.replace expands $&, $` and $' in a string replacement, so a config
  // value carrying one would come back corrupted rather than round-tripping.
  it('does not expand a replacement pattern the config value happens to carry', () => {
    const url = ADVERSARIAL_URLS['a regex replacement pattern'];
    const filled: string = fillAppConfig(PAGE, { networkId: 'preview', capacityExchangeUrl: url });
    expect((JSON.parse(inlinedText(filled)) as { capacityExchangeUrl: string }).capacityExchangeUrl).toBe(url);
  });

  it('escapes every character the html tokenizer reacts to inside a script body', () => {
    const filled: string = fillAppConfig(PAGE, { networkId: 'preview', capacityExchangeUrl: '<>&\u2028\u2029' });
    expect(inlinedText(filled)).toContain('\\u003c\\u003e\\u0026\\u2028\\u2029');
  });
});
