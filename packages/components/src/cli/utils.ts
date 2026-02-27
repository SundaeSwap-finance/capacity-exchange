export interface CliResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export async function runCli<T>(fn: () => Promise<T>): Promise<void> {
  try {
    const result = await fn();
    const output: CliResult<T> = {
      success: true,
      data: result,
    };
    console.log(JSON.stringify(output, bigintReplacer, 2));
    process.exit(0);
  } catch (error) {
    const output: CliResult<T> = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    console.error(JSON.stringify(output, bigintReplacer, 2));
    process.exit(1);
  }
}
