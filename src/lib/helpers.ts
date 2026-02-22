export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    testing: 'Testing',
    blocked: 'Blocked',
    resolved: 'Resolved',
    cancelled: 'Cancelled',
    duplicate: 'Duplicate',
  };
  return labels[status] || status;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    testing: 'bg-cyan-100 text-cyan-700',
    blocked: 'bg-red-100 text-red-700',
    resolved: 'bg-green-100 text-green-700',
    cancelled: 'bg-slate-100 text-slate-500',
    duplicate: 'bg-slate-100 text-slate-500',
  };
  return colors[status] || 'bg-slate-100 text-slate-600';
}

export function priorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    p0_critical: 'P0 Critical',
    p1_high: 'P1 High',
    p2_medium: 'P2 Medium',
    p3_low: 'P3 Low',
  };
  return labels[priority] || priority;
}

export function priorityColor(priority: string): string {
  const colors: Record<string, string> = {
    p0_critical: 'bg-red-100 text-red-700',
    p1_high: 'bg-orange-100 text-orange-700',
    p2_medium: 'bg-yellow-100 text-yellow-700',
    p3_low: 'bg-green-100 text-green-700',
  };
  return colors[priority] || 'bg-slate-100 text-slate-600';
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    developer: 'Developer',
    po: 'Product Owner',
    admin: 'Admin',
  };
  return labels[role] || role;
}

export function rejectionLabel(reason: string): string {
  const labels: Record<string, string> = {
    not_a_bug: 'Not a Bug',
    cannot_reproduce: 'Cannot Reproduce',
    duplicate: 'Duplicate',
    other: 'Other',
  };
  return labels[reason] || reason;
}

export function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function slaTimeRemaining(
  slaDeadline: string | null,
  blockedAt: string | null
): string {
  if (!slaDeadline) return 'N/A';
  if (blockedAt) return 'Paused';

  const now = new Date();
  const deadline = new Date(slaDeadline);
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) return 'Overdue';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h ${minutes}m`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
