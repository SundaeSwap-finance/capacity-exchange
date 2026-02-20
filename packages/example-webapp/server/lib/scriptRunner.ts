/**
 * Runs CLI scripts and streams output to clients via SSE.
 *
 * Scripts are executed in the contracts/ directory using bun. Their stdout/stderr
 * is streamed to the client in real-time as 'log' events. When the script exits,
 * the last JSON line of stdout is parsed as the result and sent as a 'done' event.
 */

import { spawn, type ChildProcess } from 'child_process';
import process from 'process';
import type { IncomingMessage, ServerResponse } from 'http';
import type { ScriptConfig } from '../types.js';
import { contractsDir } from './config.js';
import { setupSSE, sendEvent } from './sse.js';

type ScriptResult<T> =
  | { success: true; data?: T; exitCode: number }
  | { success: false; error: string; exitCode: number };

/**
 * Finds the last JSON line in the output.
 * CLI scripts output logs to stdout, with the final result as a JSON object on the last line.
 */
function findJsonLine(output: string): string | null {
  const lines = output.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('{') || line.startsWith('[')) {
      return line;
    }
  }
  return null;
}

/**
 * Parses script output into a result object.
 * - If script failed and no JSON found: returns stderr as the error
 * - If JSON found: parses it as the result data
 * - If no JSON but script succeeded: returns success with no data
 */
function parseScriptResult<T>(stdout: string, stderr: string, exitCode: number): ScriptResult<T> {
  const jsonLine = findJsonLine(stdout);

  if (exitCode !== 0 && !jsonLine) {
    return {
      success: false,
      error: stderr.trim() || `Script exited with code ${exitCode}`,
      exitCode,
    };
  }

  if (jsonLine) {
    try {
      return { success: true, data: JSON.parse(jsonLine), exitCode };
    } catch {
      return { success: false, error: `Failed to parse output: ${jsonLine}`, exitCode };
    }
  }

  return { success: true, exitCode };
}

/** Spawns a CLI script using bun in the contracts directory */
function spawnScript(config: ScriptConfig): ChildProcess {
  return spawn('bun', [config.script, ...config.args], {
    cwd: contractsDir,
    env: { ...process.env },
  });
}

/** Maximum time a script can run before being killed (30 seconds) */
const SCRIPT_TIMEOUT_MS = 120_000;

/**
 * Runs a CLI script and streams its output via SSE.
 *
 * Events sent to client:
 * - 'log': { stream: 'stdout' | 'stderr', text: string } - real-time output
 * - 'done': ScriptResult - final result when script exits
 *
 * If the client disconnects, the script is killed.
 * Scripts are killed after SCRIPT_TIMEOUT_MS to prevent hanging processes.
 */
export function runScript(req: IncomingMessage, res: ServerResponse, config: ScriptConfig): void {
  setupSSE(res);

  const child = spawnScript(config);
  let stdout = '';
  let stderr = '';
  let done = false;

  const finish = (result: ScriptResult<unknown>) => {
    if (done) {
      return;
    }
    done = true;
    clearTimeout(timer);
    sendEvent(res, 'done', result);
    res.end();
  };

  // Kill the script if it runs too long
  const timer = setTimeout(() => {
    if (!done) {
      child.kill();
      finish({ success: false, error: 'Script timed out', exitCode: -1 });
    }
  }, SCRIPT_TIMEOUT_MS);

  // Stream stdout to client and accumulate for result parsing
  child.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    stdout += text;
    sendEvent(res, 'log', { stream: 'stdout', text });
  });

  // Stream stderr to client and accumulate for error messages
  child.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    stderr += text;
    sendEvent(res, 'log', { stream: 'stderr', text });
  });

  // Parse result and send 'done' event when script exits
  child.on('close', (code) => {
    finish(parseScriptResult(stdout, stderr, code ?? -1));
  });

  // Handle spawn errors (e.g., script not found)
  child.on('error', (err: Error) => {
    finish({ success: false, error: err.message, exitCode: -1 });
  });

  // Kill script if client disconnects
  req.on('close', () => {
    if (!done) {
      child.kill();
      clearTimeout(timer);
    }
  });
}
