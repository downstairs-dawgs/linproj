import { Command } from 'commander';
import {
  getCurrentWorkspace,
  writeWorkspace,
  isUsingEnvAuth,
} from '../../lib/config.ts';

const SUPPORTED_KEYS = ['default-team'] as const;
type SupportedKey = (typeof SUPPORTED_KEYS)[number];

function isSupportedKey(key: string): key is SupportedKey {
  return SUPPORTED_KEYS.includes(key as SupportedKey);
}

export function createUnsetCommand(): Command {
  return new Command('unset')
    .description('Remove a config value for the current workspace')
    .argument('<key>', 'Config key to unset (supported: default-team)')
    .action(async (key: string) => {
      if (isUsingEnvAuth()) {
        console.error('Error: Config commands are not available when LINEAR_API_KEY is set.');
        console.error('');
        console.error('To use config features, unset the environment variable and run:');
        console.error('  linproj auth login');
        process.exit(1);
      }

      if (!isSupportedKey(key)) {
        console.error(`Error: Unknown config key '${key}'`);
        console.error(`Supported keys: ${SUPPORTED_KEYS.join(', ')}`);
        process.exit(1);
      }

      try {
        const workspace = await getCurrentWorkspace();

        switch (key) {
          case 'default-team':
            delete workspace.defaultTeam;
            await writeWorkspace(workspace);
            console.log('Default team cleared');
            break;
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
