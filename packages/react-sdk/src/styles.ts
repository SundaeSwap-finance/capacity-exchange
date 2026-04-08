const STYLE_ID = 'capacity-exchange-styles';

const CSS = `
  dialog[data-ce-sdk] {
    border: none;
    border-radius: var(--ce-sdk-radius, 12px);
    padding: 0;
    max-width: var(--ce-sdk-width, 480px);
    width: calc(100vw - 32px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
    font-family: var(--ce-sdk-font, 'Geist', 'DM Sans', system-ui, -apple-system, sans-serif);
    font-size: 16px;
    letter-spacing: -0.04em;
    color: var(--ce-sdk-color, #0B0514);
    background: var(--ce-sdk-bg, #ffffff);
    overflow: hidden;
  }

  @media (prefers-color-scheme: dark) {
    dialog[data-ce-sdk] {
      color: var(--ce-sdk-color, #ffffff);
      background: var(--ce-sdk-bg, #160F22);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    }
  }

  dialog[data-ce-sdk]::backdrop {
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(12px);
  }

  @media (prefers-color-scheme: dark) {
    dialog[data-ce-sdk]::backdrop {
      background: rgba(0, 0, 0, 0.5);
    }
  }

  .ce-sdk-body {
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .ce-sdk-title {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
  }

  .ce-sdk-hint {
    margin: 0;
    color: var(--ce-sdk-muted, #65597C);
    line-height: 1.5;
  }

  @media (prefers-color-scheme: dark) {
    .ce-sdk-hint { color: var(--ce-sdk-muted, #9B9CA2); }
  }

  .ce-sdk-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ce-sdk-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 20px;
    border: 1px solid var(--ce-sdk-border, #DEDEE0);
    border-radius: var(--ce-sdk-radius-sm, 8px);
    background: transparent;
    color: var(--ce-sdk-color, #0B0514);
    font-family: inherit;
    font-size: 16px;
    font-weight: 500;
    letter-spacing: -0.04em;
    cursor: pointer;
    text-align: left;
    transition: border-color 50ms, background 50ms, transform 50ms;
  }

  @media (prefers-color-scheme: dark) {
    .ce-sdk-option {
      border-color: var(--ce-sdk-border, #3B3D49);
      color: var(--ce-sdk-color, #ffffff);
    }
  }

  .ce-sdk-option:hover {
    border-color: var(--ce-sdk-accent, #4092E5);
    background: var(--ce-sdk-accent-subtle, rgba(64, 146, 229, 0.08));
  }

  @media (prefers-color-scheme: dark) {
    .ce-sdk-option:hover {
      background: var(--ce-sdk-accent-subtle, rgba(64, 146, 229, 0.12));
    }
  }

  .ce-sdk-option:active { transform: scale(0.975); }

  .ce-sdk-option-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    font-family: var(--ce-sdk-mono, 'DM Mono', ui-monospace, monospace);
    font-size: 13px;
    letter-spacing: 0;
  }

  .ce-sdk-option-amount {
    flex-shrink: 0;
    color: var(--ce-sdk-muted, #65597C);
    font-weight: 400;
  }

  @media (prefers-color-scheme: dark) {
    .ce-sdk-option-amount { color: var(--ce-sdk-muted, #9B9CA2); }
  }

  .ce-sdk-detail {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px 20px;
    padding: 16px 20px;
    background: var(--ce-sdk-subtle, #F6F6F7);
    border-radius: var(--ce-sdk-radius-sm, 8px);
  }

  @media (prefers-color-scheme: dark) {
    .ce-sdk-detail { background: var(--ce-sdk-subtle, #2B2438); }
  }

  .ce-sdk-detail-label {
    color: var(--ce-sdk-muted, #65597C);
  }

  @media (prefers-color-scheme: dark) {
    .ce-sdk-detail-label { color: var(--ce-sdk-muted, #9B9CA2); }
  }

  .ce-sdk-detail-value {
    font-weight: 500;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .ce-sdk-hex {
    display: block;
    font-family: var(--ce-sdk-mono, 'DM Mono', ui-monospace, monospace);
    font-size: 13px;
    font-weight: 400;
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    cursor: text;
    user-select: all;
  }

  .ce-sdk-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .ce-sdk-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: var(--ce-sdk-radius-sm, 8px);
    font-family: inherit;
    font-size: 16px;
    font-weight: 500;
    letter-spacing: -0.04em;
    cursor: pointer;
    border: 1px solid transparent;
    line-height: 1.4;
    transition: opacity 50ms, background 50ms, border-color 50ms, transform 50ms;
  }

  .ce-sdk-btn:hover { opacity: 0.82; }
  .ce-sdk-btn:active { opacity: 0.7; transform: scale(0.975); }
  .ce-sdk-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .ce-sdk-btn-primary {
    background: var(--ce-sdk-accent, #66A8EA);
    color: var(--ce-sdk-accent-fg, #ffffff);
  }

  @media (prefers-color-scheme: dark) {
    .ce-sdk-btn-primary { background: var(--ce-sdk-accent, #3A85D0); }
  }

  .ce-sdk-btn-secondary {
    background: transparent;
    border-color: var(--ce-sdk-border, #DEDEE0);
    color: var(--ce-sdk-color, #0B0514);
  }

  @media (prefers-color-scheme: dark) {
    .ce-sdk-btn-secondary {
      border-color: var(--ce-sdk-border, #3B3D49);
      color: var(--ce-sdk-color, #ffffff);
    }
  }

  .ce-sdk-btn-ghost {
    background: transparent;
    color: var(--ce-sdk-muted, #65597C);
  }

  @media (prefers-color-scheme: dark) {
    .ce-sdk-btn-ghost { color: var(--ce-sdk-muted, #9B9CA2); }
  }

  .ce-sdk-btn-ghost:hover {
    color: var(--ce-sdk-color, #0B0514);
    opacity: 1;
  }

  @media (prefers-color-scheme: dark) {
    .ce-sdk-btn-ghost:hover { color: var(--ce-sdk-color, #ffffff); }
  }
`;

export function injectStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}
