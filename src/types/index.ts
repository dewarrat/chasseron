export type Role = 'admin' | 'po' | 'developer';

export type TicketStatus = 'open' | 'in_progress' | 'blocked' | 'testing' | 'resolved' | 'cancelled' | 'duplicate';

export type TicketPriority = 'p0_critical' | 'p1_high' | 'p2_medium' | 'p3_low';

export type RejectionReason = 'not_a_bug' | 'cannot_reproduce' | 'duplicate' | 'other';

export type NotificationType = 'assigned' | 'unassigned' | 'status_changed' | 'commented' | 'cancellation_requested' | 'mentioned' | 'reassignment_needed';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  avatar_url: string | null;
  is_active: boolean;
  deactivated_at: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_by: string;
  created_at: string;
  sla_p0_hours: number | null;
  sla_p1_hours: number | null;
  sla_p2_hours: number | null;
  sla_p3_hours: number | null;
}

export interface GlobalSettings {
  id: string;
  sla_p0_hours: number;
  sla_p1_hours: number;
  sla_p2_hours: number;
  sla_p3_hours: number;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'po' | 'developer';
  joined_at: string;
  profiles?: Profile;
}

export interface Ticket {
  id: number;
  project_id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to: string | null;
  created_by: string;
  sort_order: number;
  duplicate_of: number | null;
  rejection_reason: RejectionReason | null;
  sla_deadline: string | null;
  blocked_at: string | null;
  report_link: string | null;
  sla_paused_duration: string;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  creator?: Profile;
  project?: Project;
}

export interface TicketComment {
  id: string;
  ticket_id: number;
  author_id: string;
  body: string;
  is_system_generated: boolean;
  created_at: string;
  author?: Profile;
}

export interface Label {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TicketLabel {
  id: string;
  ticket_id: number;
  label_id: string;
  label?: Label;
}

export interface TicketAttachment {
  id: string;
  ticket_id: number;
  uploaded_by: string;
  file_name: string;
  file_size: number;
  content_type: string;
  storage_path: string;
  created_at: string;
  uploader?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  ticket_id: number | null;
  type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ReassignmentTask {
  id: string;
  ticket_id: number;
  project_owner_id: string;
  deactivated_user_id: string;
  is_completed: boolean;
  created_at: string;
  completed_at: string | null;
  ticket?: Ticket;
  deactivated_user?: Profile;
}
