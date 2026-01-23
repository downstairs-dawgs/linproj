import { Command } from 'commander';
import { readConfig, writeConfig, type ApiKeyAuth } from '../../lib/config.ts';
import { LinearClient, getViewer, LinearAPIError } from '../../lib/api.ts';

async function readApiKeyFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8').trim();
}

async function promptApiKey(): Promise<string> {
  // Check if stdin is a TTY
  if (!process.stdin.isTTY) {
    // Read from stdin pipe
    return readApiKeyFromStdin();
  }

  // Interactive prompt with hidden input
  process.stdout.write(
    'To create an API key:\n' +
      '1. Go to Linear Settings > Account > Security & Access\n' +
      '2. Under "API keys", click "Create key"\n' +
      '3. Give it a label (e.g., "linproj") and select permissions\n\n' +
      'Paste your API key: '
  );

  // Hide input
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  return new Promise((resolve) => {
    let input = '';
    const onData = (data: Buffer) => {
      const char = data.toString('utf-8');

      // Handle enter
      if (char === '\n' || char === '\r') {
        process.stdin.removeListener('data', onData);
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(input);
        return;
      }

      // Handle backspace
      if (char === '\x7f' || char === '\b') {
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
        return;
      }

      // Handle Ctrl+C
      if (char === '\x03') {
        process.stdout.write('\n');
        process.exit(1);
      }

      input += char;
    };

    process.stdin.on('data', onData);
  });
}

async function loginWithApiKey(): Promise<void> {
  const apiKey = await promptApiKey();

  if (!apiKey) {
    console.error('Error: No API key provided');
    process.exit(1);
  }

  // Validate the API key
  const auth: ApiKeyAuth = { type: 'api-key', apiKey };
  const client = new LinearClient(auth);

  try {
    const user = await getViewer(client);

    // Save to config
    const config = await readConfig();
    config.auth = auth;
    await writeConfig(config);

    console.log(`✓ Authenticated as ${user.name} (${user.email})`);
  } catch (err) {
    if (err instanceof LinearAPIError) {
      if (err.status === 401) {
        console.error('Error: Invalid API key');
      } else {
        console.error(`Error: ${err.message}`);
      }
    } else {
      console.error(`Error: ${err}`);
    }
    process.exit(1);
  }
}

async function loginWithOAuth(): Promise<void> {
  console.error('Error: OAuth authentication not yet implemented');
  console.error('Please use --method api-key for now');
  process.exit(1);
}

export function createLoginCommand(): Command {
  return new Command('login')
    .description('Authenticate with Linear')
    .option(
      '-m, --method <method>',
      'Authentication method (api-key, oauth)',
      'api-key'
    )
    .action(async (options: { method: string }) => {
      switch (options.method) {
        case 'api-key':
          await loginWithApiKey();
          break;
        case 'oauth':
          await loginWithOAuth();
          break;
        default:
          console.error(`Error: Unknown authentication method: ${options.method}`);
          console.error('Valid methods: api-key, oauth');
          process.exit(1);
      }
    });
}
