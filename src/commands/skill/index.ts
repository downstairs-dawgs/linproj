import { Command, Option } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { SKILLS, SKILL_NAMES, type SkillEntry } from './skills.ts';

const MODE_BASES: Record<string, string> = {
  'claude': '~/.claude/skills',
  'claude-global': '~/.claude/skills',
  'claude-project': '.claude/skills',
  'codex': '~/.codex/skills',
  'codex-global': '~/.codex/skills',
  'codex-project': '.codex/skills',
  'universal': '~/.agent/skills',
  'universal-global': '~/.agent/skills',
  'universal-project': '.agent/skills',
  'github': '.github/skills',
};

function expandPath(path: string): string {
  return path.startsWith('~') ? path.replace('~', homedir()) : path;
}

function printSkillList(): void {
  console.log('Available skills:\n');
  for (const name of SKILL_NAMES) {
    const skill = SKILLS[name]!;
    console.log(`  ${name.padEnd(16)} ${skill.description}`);
  }
  console.log('\nUsage:');
  console.log('  linproj skill <name>                  Print skill to stdout');
  console.log('  linproj skill --mode claude --force    Install all skills');
  console.log('  linproj skill <name> --mode claude     Install one skill');
}

async function installSkill(skill: SkillEntry, baseDir: string, force: boolean): Promise<void> {
  const outputPath = expandPath(join(baseDir, skill.dirname, 'SKILL.md'));
  const dir = expandPath(join(baseDir, skill.dirname));

  if (!existsSync(dir)) {
    if (!force) {
      console.error(`Error: Directory does not exist: ${dir}`);
      console.error('Use --force to create it');
      process.exit(1);
    }
    await mkdir(dir, { recursive: true });
  }

  await writeFile(outputPath, skill.content);
  console.log(`Installed ${skill.name} to: ${outputPath}`);
}

export function createSkillCommand(): Command {
  const skill = new Command('skill')
    .description('Output or install Agent Skills spec (agentskills.io) SKILL.md files')
    .argument('[name]', 'Skill name to print or install');

  const modeOption = new Option('-m, --mode <mode>', 'Installation mode')
    .choices(Object.keys(MODE_BASES));

  skill
    .addOption(modeOption)
    .option('-o, --outdir <path>', 'Output base directory for SKILL.md files')
    .option('-f, --force', 'Create parent directories if needed')
    .action(async (name: string | undefined, options) => {
      if (options.mode && options.outdir) {
        console.error('Error: Cannot use --mode and --outdir together');
        process.exit(1);
      }

      const hasOutput = options.mode || options.outdir;

      if (name && !SKILLS[name]) {
        console.error(`Error: Unknown skill "${name}". Available: ${SKILL_NAMES.join(', ')}`);
        process.exit(1);
      }

      if (!name && !hasOutput) {
        printSkillList();
        return;
      }

      if (name && !hasOutput) {
        console.log(SKILLS[name]!.content);
        return;
      }

      const baseDir = options.outdir ?? MODE_BASES[options.mode]!;
      const skillsToInstall = name ? [SKILLS[name]!] : Object.values(SKILLS);

      for (const entry of skillsToInstall) {
        await installSkill(entry, baseDir, !!options.force);
      }
    });

  return skill;
}
