import yaml from 'js-yaml';
import type { Issue } from './api.ts';

export interface ParsedInput {
  fields: EditFields;
  description?: string;
}

export interface EditFields {
  title?: string;
  state?: string;
  priority?: 'none' | 'urgent' | 'high' | 'medium' | 'low';
  assignee?: 'me' | 'none' | string;
  labels?: string[];
  project?: 'none' | string;
  team?: string;
  dueDate?: 'none' | string;
  estimate?: number;
}

const ALLOWED_FIELDS = new Set([
  'title',
  'state',
  'priority',
  'assignee',
  'labels',
  'project',
  'team',
  'dueDate',
  'estimate',
]);

const VALID_PRIORITIES = new Set(['none', 'urgent', 'high', 'medium', 'low']);

export class FrontmatterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrontmatterError';
  }
}

export function parseFrontmatter(input: string): ParsedInput {
  const trimmed = input.trim();

  if (!trimmed.startsWith('---')) {
    return {
      fields: {},
      description: trimmed || undefined,
    };
  }

  const secondDelimiter = trimmed.indexOf('---', 3);

  if (secondDelimiter === -1) {
    const yamlContent = trimmed.slice(3).trim();
    return { fields: parseYamlContent(yamlContent) };
  }

  const yamlContent = trimmed.slice(3, secondDelimiter).trim();
  const body = trimmed.slice(secondDelimiter + 3).trim();

  return {
    fields: parseYamlContent(yamlContent),
    description: body || undefined,
  };
}

function parseYamlContent(yamlContent: string): EditFields {
  if (!yamlContent) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(yamlContent);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new FrontmatterError(`Invalid YAML in frontmatter: ${message}`);
  }

  if (parsed === null || parsed === undefined) {
    return {};
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new FrontmatterError('Frontmatter must be a YAML object');
  }

  const obj = parsed as Record<string, unknown>;
  const fields: EditFields = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === 'description') {
      throw new FrontmatterError(
        "Use the body for description, not the 'description' field"
      );
    }

    if (!ALLOWED_FIELDS.has(key)) {
      const validFields = Array.from(ALLOWED_FIELDS).join(', ');
      throw new FrontmatterError(
        `Unknown field '${key}'. Valid fields: ${validFields}`
      );
    }

    validateField(key, value);
    (fields as Record<string, unknown>)[key] = value;
  }

  return fields;
}

function validateField(key: string, value: unknown): void {
  switch (key) {
    case 'title':
      if (typeof value !== 'string') {
        throw new FrontmatterError(`Field 'title' must be a string`);
      }
      if (value.trim() === '') {
        throw new FrontmatterError('Title cannot be empty');
      }
      break;

    case 'state':
      if (typeof value !== 'string') {
        throw new FrontmatterError(`Field 'state' must be a string`);
      }
      break;

    case 'priority':
      if (typeof value !== 'string') {
        throw new FrontmatterError(`Field 'priority' must be a string`);
      }
      if (!VALID_PRIORITIES.has(value.toLowerCase())) {
        throw new FrontmatterError(
          `Invalid priority '${value}'. Valid values: urgent, high, medium, low, none`
        );
      }
      break;

    case 'assignee':
      if (typeof value !== 'string') {
        throw new FrontmatterError(`Field 'assignee' must be a string`);
      }
      break;

    case 'labels':
      if (!Array.isArray(value)) {
        throw new FrontmatterError(`Field 'labels' must be an array`);
      }
      for (const label of value) {
        if (typeof label !== 'string') {
          throw new FrontmatterError('Each label must be a string');
        }
      }
      break;

    case 'project':
      if (typeof value !== 'string') {
        throw new FrontmatterError(`Field 'project' must be a string`);
      }
      break;

    case 'team':
      if (typeof value !== 'string') {
        throw new FrontmatterError(`Field 'team' must be a string`);
      }
      break;

    case 'dueDate':
      if (typeof value !== 'string') {
        throw new FrontmatterError(`Field 'dueDate' must be a string`);
      }
      if (value !== 'none' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new FrontmatterError(
          `Invalid dueDate '${value}'. Use ISO format (YYYY-MM-DD) or 'none'`
        );
      }
      break;

    case 'estimate':
      if (typeof value !== 'number') {
        throw new FrontmatterError(`Field 'estimate' must be a number`);
      }
      break;
  }
}

export function formatPriority(priority: number): string {
  switch (priority) {
    case 0:
      return 'none';
    case 1:
      return 'urgent';
    case 2:
      return 'high';
    case 3:
      return 'medium';
    case 4:
      return 'low';
    default:
      return 'none';
  }
}

export function renderFrontmatter(issue: Issue): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push(`# Editing ${issue.identifier}`);
  lines.push('# Delete fields you don\'t want to change');
  lines.push('# Save and close to apply changes');
  lines.push('# To cancel: delete all content, or leave unchanged');
  lines.push('');
  lines.push(`title: '${escapeYamlString(issue.title)}'`);
  lines.push(`state: '${issue.state.name}'`);
  lines.push(`priority: ${formatPriority(issue.priority)}`);

  if (issue.assignee) {
    lines.push(`assignee: ${issue.assignee.email}`);
  } else {
    lines.push(`assignee: none`);
  }

  if (issue.labels && issue.labels.nodes.length > 0) {
    lines.push('labels:');
    for (const label of issue.labels.nodes) {
      lines.push(`  - ${label.name}`);
    }
  } else {
    lines.push('labels: []');
  }

  if (issue.project) {
    lines.push(`project: '${escapeYamlString(issue.project.name)}'`);
  }

  lines.push('---');

  if (issue.description) {
    lines.push('');
    lines.push(issue.description);
  }

  return lines.join('\n');
}

function escapeYamlString(str: string): string {
  return str.replace(/'/g, "''");
}
