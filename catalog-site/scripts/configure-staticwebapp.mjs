import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCTION_API_ORIGIN = 'https://api.curations.dev';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'dist', 'staticwebapp.config.json');

export function configureAgentOrigin(config, rawAgentApi) {
  const agentApi = new URL(rawAgentApi || PRODUCTION_API_ORIGIN);
  if (agentApi.protocol !== 'https:' || agentApi.username || agentApi.password) {
    throw new Error('PUBLIC_AGENT_API must be an HTTPS origin without credentials');
  }

  const csp = config.globalHeaders?.['Content-Security-Policy'];
  if (typeof csp !== 'string') {
    throw new Error('Static Web Apps Content-Security-Policy is missing');
  }

  const directives = csp
    .split(';')
    .map((directive) => directive.trim())
    .filter(Boolean);
  const index = directives.findIndex((directive) => directive.startsWith('connect-src '));
  if (index < 0) {
    throw new Error('Static Web Apps connect-src directive is missing');
  }

  const sources = directives[index].split(/\s+/).slice(1);
  const exactSources = sources.filter((source) => !source.includes('*.azurecontainerapps.io'));
  for (const origin of [PRODUCTION_API_ORIGIN, agentApi.origin]) {
    if (!exactSources.includes(origin)) exactSources.push(origin);
  }
  directives[index] = `connect-src ${exactSources.join(' ')}`;

  return {
    ...config,
    globalHeaders: {
      ...config.globalHeaders,
      'Content-Security-Policy': `${directives.join('; ')};`,
    },
  };
}

export function writeConfiguredStaticWebApp({
  configPath = DEFAULT_CONFIG_PATH,
  agentApi = process.env.PUBLIC_AGENT_API,
} = {}) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const configured = configureAgentOrigin(config, agentApi);
  fs.writeFileSync(configPath, `${JSON.stringify(configured, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeConfiguredStaticWebApp();
}
