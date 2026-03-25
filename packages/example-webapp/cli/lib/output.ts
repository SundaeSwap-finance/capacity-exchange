import * as p from "@clack/prompts";

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
export function createSpinner(json: boolean) {
  if (json) {
    return {
      start(_msg?: string) {},
      stop(_msg?: string) {},
      message(_msg: string) {},
    };
  }
  return p.spinner();
}

export function printHeader(json: boolean, title: string): void {
  if (!json) {
    p.intro(title);
  }
}

export function printSuccess(json: boolean, message: string): void {
  if (!json) {
    p.outro(message);
  }
}

export function printNote(json: boolean, message: string, title?: string): void {
  if (!json) {
    p.note(message, title);
  }
}
