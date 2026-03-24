import * as p from "@clack/prompts";

let jsonMode = false;

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function printJson(data: unknown): void {
  const replacer = (_key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value;
  console.log(JSON.stringify(data, replacer, 2));
}

export function printJsonError(message: string): void {
  console.error(JSON.stringify({ error: message }));
}

/**
 * Creates a spinner that works in human mode, no-ops in JSON mode.
 */
export function createSpinner() {
  if (jsonMode) {
    return {
      start(_msg?: string) {},
      stop(_msg?: string) {},
      message(_msg: string) {},
    };
  }
  return p.spinner();
}

export function printHeader(title: string): void {
  if (!jsonMode) {
    p.intro(title);
  }
}

export function printSuccess(message: string): void {
  if (!jsonMode) {
    p.outro(message);
  }
}

export function printNote(message: string, title?: string): void {
  if (!jsonMode) {
    p.note(message, title);
  }
}
