import { Command, Option } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import SKILL_MD from './SKILL.md' with { type: 'text' };

const MODE_PATHS: Record<string, string> = {
  'claude': '~/.claude/skills/linear/SKILL.md',
  'claude-global': '~/.claude/skills/linear/SKILL.md',
  'claude-project': '.claude/skills/linear/SKILL.md',
  'codex': '~/.codex/skills/linear/SKILL.md',
  'codex-global': '~/.codex/skills/linear/SKILL.md',
  'codex-project': '.codex/skills/linear/SKILL.md',
  'universal': '~/.agent/skills/linear/SKILL.md',
  'universal-global': '~/.agent/skills/linear/SKILL.md',
  'universal-project': '.agent/skills/linear/SKILL.md',
  'github': '.github/skills/linear/SKILL.md',
};

function expandPath(path: string): string {
  return path.startsWith('~') ? path.replace('~', homedir()) : path;
}

export function createSkillCommand(): Command {
  const skill = new Command('skill')
    .description('Output or install Agent Skills spec (agentskills.io) SKILL.md');

  const modeOption = new Option('-m, --mode <mode>', 'Installation mode')
    .choices(Object.keys(MODE_PATHS));

  skill
    .addOption(modeOption)
    .option('-o, --outdir <path>', 'Output directory for SKILL.md')
    .option('-f, --force', 'Create parent directories if needed')
    .action(async (options) => {
      // Mutually exclusive check
      if (options.mode && options.outdir) {
        console.error('Error: Cannot use --mode and --outdir together');
        process.exit(1);
      }

      // Determine output path
      let outputPath: string;
      if (options.outdir) {
        outputPath = expandPath(join(options.outdir, 'SKILL.md'));
      } else if (options.mode) {
        outputPath = expandPath(MODE_PATHS[options.mode]);
      } else {
        // Default: print to stdout
        console.log(SKILL_MD);
        return;
      }

      // Check/create parent directory
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        if (!options.force) {
          console.error(`Error: Directory does not exist: ${dir}`);
          console.error('Use --force to create it');
          process.exit(1);
        }
        await mkdir(dir, { recursive: true });
      }

      // Write file
      await writeFile(outputPath, SKILL_MD);
      console.log(`Installed skill to: ${outputPath}`);
    });

  return skill;
}
