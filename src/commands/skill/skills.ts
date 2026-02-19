import linearMd from './skills/linear/SKILL.md' with { type: 'text' };
import meetingSyncMd from './skills/meeting-sync/SKILL.md' with { type: 'text' };
import weeklyPrepMd from './skills/weekly-prep/SKILL.md' with { type: 'text' };
import weeklyUpdateMd from './skills/weekly-update/SKILL.md' with { type: 'text' };
import lintProjectMd from './skills/lint-project/SKILL.md' with { type: 'text' };

export interface SkillEntry {
  name: string;
  dirname: string;
  description: string;
  content: string;
}

export const SKILLS: Record<string, SkillEntry> = {
  linear: {
    name: 'linear',
    dirname: 'linear',
    description: 'Manage Linear issues using linproj CLI',
    content: linearMd,
  },
  'meeting-sync': {
    name: 'meeting-sync',
    dirname: 'linear-meeting-sync',
    description: 'Sync meeting notes back to Linear issues',
    content: meetingSyncMd,
  },
  'weekly-prep': {
    name: 'weekly-prep',
    dirname: 'linear-weekly-prep',
    description: 'Prepare for the weekly Monday meeting',
    content: weeklyPrepMd,
  },
  'weekly-update': {
    name: 'weekly-update',
    dirname: 'linear-weekly-update',
    description: 'Draft a weekly project status update',
    content: weeklyUpdateMd,
  },
  'lint-project': {
    name: 'lint-project',
    dirname: 'linear-lint-project',
    description: 'Lint project issues against best practices',
    content: lintProjectMd,
  },
};

export const SKILL_NAMES = Object.keys(SKILLS);
