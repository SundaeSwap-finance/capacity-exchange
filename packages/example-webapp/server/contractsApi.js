import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsDir = join(__dirname, '../contracts');

/**
 * Parse JSON body from request
 */
async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Get script and args for a route
 */
function getScriptConfig(routeKey, body) {
  const configs = {
    // Counter contract
    'POST /api/counter/deploy': {
      script: 'src/counter/cli/deploy.ts',
      args: [],
    },
    'POST /api/counter/increment': {
      script: 'src/counter/cli/increment.ts',
      args: [body.contractAddress],
      validate: () => {
        if (!body.contractAddress) throw new Error('contractAddress is required');
      },
    },
    'POST /api/counter/query': {
      script: 'src/counter/cli/query.ts',
      args: [body.contractAddress],
      validate: () => {
        if (!body.contractAddress) throw new Error('contractAddress is required');
      },
    },
    // Token mint contract
    'POST /api/token-mint/deploy': {
      script: 'src/token-mint/cli/deploy.ts',
      args: body.tokenColor ? [body.tokenColor] : [],
    },
    'POST /api/token-mint/mint': {
      script: 'src/token-mint/cli/mint.ts',
      args: [body.contractAddress, body.privateStateId, String(body.amount)],
      validate: () => {
        if (!body.contractAddress || !body.privateStateId || !body.amount) {
          throw new Error('contractAddress, privateStateId, and amount are required');
        }
      },
    },
    'POST /api/token-mint/verify': {
      script: 'src/token-mint/cli/verify.ts',
      args: [body.contractAddress, body.tokenColor],
      validate: () => {
        if (!body.contractAddress || !body.tokenColor) {
          throw new Error('contractAddress and tokenColor are required');
        }
      },
    },
  };

  return configs[routeKey];
}

/**
 * Vite plugin that adds contract API middleware with SSE streaming
 */
export function contractsApiPlugin() {
  return {
    name: 'contracts-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const routeKey = `${req.method} ${req.url?.split('?')[0]}`;

        // Check if this is an API route
        if (!routeKey.startsWith('POST /api/')) {
          return next();
        }

        const body = await parseBody(req);
        const config = getScriptConfig(routeKey, body);

        if (!config) {
          return next();
        }

        // Validate if needed
        if (config.validate) {
          try {
            config.validate();
          } catch (error) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: error.message }));
            return;
          }
        }

        // Set up SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const sendEvent = (type, data) => {
          res.write(`event: ${type}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Spawn the script
        const child = spawn('npx', ['tsx', config.script, ...config.args], {
          cwd: contractsDir,
          env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          const text = data.toString();
          stdout += text;
          sendEvent('log', { stream: 'stdout', text });
        });

        child.stderr.on('data', (data) => {
          const text = data.toString();
          stderr += text;
          sendEvent('log', { stream: 'stderr', text });
        });

        child.on('close', (code) => {
          // Find JSON result in stdout
          const lines = stdout.trim().split('\n');
          let jsonLine = null;
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') || line.startsWith('[')) {
              jsonLine = line;
              break;
            }
          }

          let result = null;
          let error = null;

          if (code !== 0 && !jsonLine) {
            error = stderr || stdout || `Script exited with code ${code}`;
          } else if (jsonLine) {
            try {
              result = JSON.parse(jsonLine);
            } catch (e) {
              error = `Failed to parse output: ${jsonLine}`;
            }
          }

          sendEvent('done', {
            success: !error,
            data: result,
            error,
            exitCode: code,
          });

          res.end();
        });

        child.on('error', (err) => {
          sendEvent('done', {
            success: false,
            error: err.message,
          });
          res.end();
        });

        // Handle client disconnect
        req.on('close', () => {
          child.kill();
        });
      });
    },
  };
}
