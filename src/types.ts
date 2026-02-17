export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'developer' | 'po' | 'admin';
  created_at: string;
  is_active: boolean;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  created_at: string;
  created_by: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'blocked' | 'testing' | 'resolved' | 'cancelled' | 'duplicate';
  priority: 'p0_critical' | 'p1_high' | 'p2_medium' | 'p3_low';
  project_id: string;
  project?: Project;
  assigned_to: string | null;
  assignee?: Profile | null;
  created_by: string;
  creator?: Profile;
  created_at: string;
  updated_at: string;
  sla_deadline: string | null;
}

export interface Comment {
  id: number;
  ticket_id: number;
  user_id: string;
  user?: Profile;
  content: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  type: 'assigned' | 'unassigned' | 'status_changed' | 'commented' | 'cancellation_requested' | 'mentioned' | 'user_deactivation_requested';
  ticket_id: number | null;
  ticket?: Ticket;
  is_read: boolean;
  created_at: string;
}

export interface GlobalSettings {
  id: string;
  sla_p0_hours: number;
  sla_p1_hours: number;
  sla_p2_hours: number;
  sla_p3_hours: number;
  updated_at: string;
}
