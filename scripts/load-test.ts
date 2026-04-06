import { parseArgs } from 'util';
import { readFileSync, writeFileSync } from 'fs';

interface Config {
  server: string;
  users: number;
  specks: string;
  currency: string;
  currencyOverridden: boolean;
  output: string;
}

type ResultCategory = 'success' | 'utxo_exhaustion' | 'server_error' | 'other_error';

interface RequestResult {
  userId: number;
  status: number;
  latencyMs: number;
  category: ResultCategory;
  error?: string;
}

interface LatencyStats {
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

interface Summary {
  totalRequests: number;
  durationMs: number;
  requestsPerSecond: number;
  success: { count: number; percent: number };
  utxoExhaustion: { count: number; percent: number };
  serverError: { count: number; percent: number };
  otherError: { count: number; percent: number };
  latency: LatencyStats | null;
}

interface TestOutput {
  config: Config;
  summary: Summary;
  requests: RequestResult[];
}

const DEFAULTS: Config = {
  server: 'http://localhost:3000',
  users: 10,
  specks: '1000',
  currency: 'lovelace',
  currencyOverridden: false,
  output: './load-test-results.json',
};

function printUsage() {
  console.log(`
CES Load Test
=============

Usage: bun scripts/load-test.ts [options]

Options:
  --server <url>       CES server URL (default: ${DEFAULTS.server})
  --users <n>          Number of concurrent users/requests (default: ${DEFAULTS.users})
  --specks <n>         Specks amount per offer request (default: ${DEFAULTS.specks})
  --currency <name>    Offer currency (default: ${DEFAULTS.currency})
  --config <path>      Path to JSON config file (overrides defaults, overridden by flags)
  --output <path>      Path for JSON results file (default: ${DEFAULTS.output})
  --help               Show this help
`);
}

function parseConfig(): Config {
  const { values } = parseArgs({
    options: {
      server: { type: 'string' },
      users: { type: 'string' },
      specks: { type: 'string' },
      currency: { type: 'string' },
      config: { type: 'string' },
      output: { type: 'string' },
      help: { type: 'boolean' },
    },
    strict: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  let config = { ...DEFAULTS };

  if (values.config) {
    try {
      const fileConfig = JSON.parse(readFileSync(values.config, 'utf-8'));
      if (fileConfig.currency) {
        fileConfig.currencyOverridden = true;
      }
      config = { ...config, ...fileConfig };
    } catch (err) {
      console.error(`Error reading config file: ${values.config}`);
      console.error((err as Error).message);
      process.exit(1);
    }
  }

  if (values.server) {
    config.server = values.server;
  }
  if (values.users) {
    config.users = parseInt(values.users, 10);
  }
  if (values.specks) {
    config.specks = values.specks;
  }
  if (values.currency) {
    config.currency = values.currency;
    config.currencyOverridden = true;
  }
  if (values.output) {
    config.output = values.output;
  }

  if (isNaN(config.users) || config.users < 1) {
    console.error(`Invalid --users value: must be a positive integer`);
    process.exit(1);
  }
  if (!/^[1-9][0-9]*$/.test(config.specks)) {
    console.error(`Invalid --specks value: must be a positive integer string`);
    process.exit(1);
  }

  return config;
}

function categorize(status: number): ResultCategory {
  if (status === 201) {
    return 'success';
  }
  if (status === 409) {
    return 'utxo_exhaustion';
  }
  if (status >= 500) {
    return 'server_error';
  }
  return 'other_error';
}

async function sendOffer(config: Config, userId: number): Promise<RequestResult> {
  const start = performance.now();
  try {
    const response = await fetch(`${config.server}/api/offers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specks: config.specks,
        offerCurrency: config.currency,
      }),
    });

    const latencyMs = Math.round(performance.now() - start);
    const category = categorize(response.status);

    const result: RequestResult = {
      userId,
      status: response.status,
      latencyMs,
      category,
    };

    if (category !== 'success') {
      const text = await response.text().catch(() => '');
      try {
        const body = JSON.parse(text);
        result.error = (body as { message?: string }).message || text;
      } catch {
        result.error = text || 'empty response';
      }
    }

    return result;
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      userId,
      status: 0,
      latencyMs,
      category: 'other_error',
      error: (err as Error).message,
    };
  }
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeLatencyStats(results: RequestResult[]): LatencyStats | null {
  const successful = results
    .filter((r) => r.category === 'success')
    .map((r) => r.latencyMs)
    .sort((a, b) => a - b);

  if (successful.length === 0) {
    return null;
  }

  return {
    min: successful[0],
    p50: percentile(successful, 50),
    p95: percentile(successful, 95),
    p99: percentile(successful, 99),
    max: successful[successful.length - 1],
  };
}

function computeSummary(results: RequestResult[], durationMs: number): Summary {
  const total = results.length;
  const count = (cat: ResultCategory) => results.filter((r) => r.category === cat).length;
  const pct = (n: number) => Math.round((n / total) * 1000) / 10;

  const success = count('success');
  const utxo = count('utxo_exhaustion');
  const serverErr = count('server_error');
  const other = count('other_error');

  return {
    totalRequests: total,
    durationMs,
    requestsPerSecond: Math.round((total / (durationMs / 1000)) * 100) / 100,
    success: { count: success, percent: pct(success) },
    utxoExhaustion: { count: utxo, percent: pct(utxo) },
    serverError: { count: serverErr, percent: pct(serverErr) },
    otherError: { count: other, percent: pct(other) },
    latency: computeLatencyStats(results),
  };
}

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

function fmtMs(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function printSummary(config: Config, summary: Summary) {
  const w = 50;
  console.log('');
  console.log('='.repeat(w));
  console.log('CES Load Test Results');
  console.log('='.repeat(w));
  console.log(`  Server:     ${config.server}`);
  console.log(`  Users:      ${config.users}`);
  console.log(`  Specks:     ${config.specks}`);
  console.log(`  Currency:   ${config.currency}`);
  console.log(`  Duration:   ${fmtMs(summary.durationMs)}`);
  console.log('');

  console.log('Results:');
  const fmtLine = (label: string, count: number, pct: number) =>
    `  ${pad(label, 28)} ${String(count).padStart(4)}  (${pct.toFixed(1)}%)`;
  console.log(fmtLine('Success (201):', summary.success.count, summary.success.percent));
  console.log(fmtLine('UTXO exhaustion (409):', summary.utxoExhaustion.count, summary.utxoExhaustion.percent));
  console.log(fmtLine('Server error (5xx):', summary.serverError.count, summary.serverError.percent));
  console.log(fmtLine('Other error:', summary.otherError.count, summary.otherError.percent));
  console.log('');

  if (summary.latency) {
    console.log('Latency (successful requests):');
    console.log(`  Min:   ${fmtMs(summary.latency.min)}`);
    console.log(`  p50:   ${fmtMs(summary.latency.p50)}`);
    console.log(`  p95:   ${fmtMs(summary.latency.p95)}`);
    console.log(`  p99:   ${fmtMs(summary.latency.p99)}`);
    console.log(`  Max:   ${fmtMs(summary.latency.max)}`);
  } else {
    console.log('Latency: no successful requests');
  }
  console.log('');

  console.log('Throughput:');
  console.log(`  Total requests:  ${summary.totalRequests}`);
  console.log(`  Requests/sec:    ${summary.requestsPerSecond}`);
  console.log('='.repeat(w));
  console.log('');
}

async function checkServer(server: string): Promise<void> {
  try {
    const res = await fetch(`${server}/health/ready`, { signal: AbortSignal.timeout(5000) });
    if (res.status !== 200) {
      const body = await res.json().catch(() => ({}));
      console.warn(`Warning: server readiness check returned ${res.status}:`, body);
      console.warn('Proceeding anyway...\n');
    }
  } catch (err) {
    console.error(`Error: cannot reach server at ${server}`);
    console.error((err as Error).message);
    process.exit(1);
  }
}

async function discoverCurrency(config: Config): Promise<string> {
  const res = await fetch(`${config.server}/api/prices?specks=${config.specks}`);
  if (res.status !== 200) {
    const text = await res.text().catch(() => '');
    throw new Error(`/api/prices returned ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { prices: { currency: string; amount: string }[] };
  if (!data.prices?.length) {
    throw new Error('No currencies available from /api/prices');
  }
  return data.prices[0].currency;
}

async function main() {
  const config = parseConfig();

  await checkServer(config.server);

  // Auto-detect currency from the server if not explicitly set
  if (!config.currencyOverridden) {
    try {
      const currency = await discoverCurrency(config);
      config.currency = currency;
      console.log(`Auto-detected currency: ${currency}`);
    } catch (err) {
      console.error(`Failed to discover currency: ${(err as Error).message}`);
      console.error(`Falling back to default: ${config.currency}`);
    }
  }

  console.log(`CES Load Test: ${config.users} users -> ${config.server}`);
  console.log(`  specks=${config.specks} currency=${config.currency}\n`);

  console.log(`Firing ${config.users} concurrent requests...`);
  const testStart = performance.now();

  const results = await Promise.all(Array.from({ length: config.users }, (_, i) => sendOffer(config, i)));

  const durationMs = Math.round(performance.now() - testStart);
  const summary = computeSummary(results, durationMs);

  printSummary(config, summary);

  const output: TestOutput = { config, summary, requests: results };
  writeFileSync(config.output, JSON.stringify(output, null, 2));
  console.log(`Detailed results written to: ${config.output}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
