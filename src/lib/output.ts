import type { Issue } from './api.ts';

export function formatPriority(priority: number): string {
  switch (priority) {
    case 0:
      return '-';
    case 1:
      return 'Urgent';
    case 2:
      return 'High';
    case 3:
      return 'Medium';
    case 4:
      return 'Low';
    default:
      return String(priority);
  }
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

export function printIssuesTable(issues: Issue[]): void {
  if (issues.length === 0) {
    console.log('No issues found');
    return;
  }

  // Calculate column widths
  const idWidth = Math.max(2, ...issues.map((i) => i.identifier.length));
  const stateWidth = Math.max(5, ...issues.map((i) => i.state.name.length));
  const priorityWidth = 8;

  // Header
  console.log(
    `${padRight('ID', idWidth)}  ${padRight('STATE', stateWidth)}  ${padRight('PRIORITY', priorityWidth)}  TITLE`
  );

  // Rows
  for (const issue of issues) {
    console.log(
      `${padRight(issue.identifier, idWidth)}  ${padRight(issue.state.name, stateWidth)}  ${padRight(formatPriority(issue.priority), priorityWidth)}  ${issue.title}`
    );
  }
}

export function outputIssues(issues: Issue[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify(issues, null, 2));
  } else {
    printIssuesTable(issues);
  }
}
