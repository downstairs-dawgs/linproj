import { describe, it, expect } from 'bun:test';
import { SKILLS, SKILL_NAMES } from '../../src/commands/skill/skills.ts';

describe('skill registry', () => {
  it('has 5 entries', () => {
    expect(SKILL_NAMES).toHaveLength(5);
  });

  it('contains all expected skill names', () => {
    expect(SKILL_NAMES).toEqual([
      'linear',
      'meeting-sync',
      'weekly-prep',
      'weekly-update',
      'lint-project',
    ]);
  });

  it('each entry has non-empty content starting with frontmatter', () => {
    for (const name of SKILL_NAMES) {
      const skill = SKILLS[name]!;
      expect(skill.content.length).toBeGreaterThan(0);
      expect(skill.content.startsWith('---\nname:')).toBe(true);
    }
  });

  it('workflow skills use linear- prefix for dirname', () => {
    const workflowSkills = ['meeting-sync', 'weekly-prep', 'weekly-update', 'lint-project'];
    for (const name of workflowSkills) {
      const skill = SKILLS[name]!;
      expect(skill.dirname).toBe(`linear-${name}`);
    }
  });

  it('core skill dirname is linear', () => {
    expect(SKILLS['linear']!.dirname).toBe('linear');
  });
});
