export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    backlog: 'Backlog',
    todo: 'To Do',
    in_progress: 'In Progress',
    testing: 'Testing',
    blocked: 'Blocked',
    done: 'Done',
  };
  return labels[status] || status;
}

export function priorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    p0: 'P0 - Critical',
    p1: 'P1 - High',
    p2: 'P2 - Medium',
    p3: 'P3 - Low',
  };
  return labels[priority] || priority;
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    dev: 'Developer',
    po: 'Product Owner',
    admin: 'Admin',
  };
  return labels[role] || role;
}
