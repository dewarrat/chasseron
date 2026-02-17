export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'developer' | 'po' | 'admin';
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  created_by: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'testing' | 'blocked' | 'done';
  priority: 'p0' | 'p1' | 'p2' | 'p3';
  project_id: number;
  project?: Project;
  assigned_to: string | null;
  assignee?: Profile | null;
  created_by: string;
  creator?: Profile;
  created_at: string;
  updated_at: string;
  deadline: string | null;
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
  id: number;
  user_id: string;
  message: string;
  type: 'assignment' | 'comment' | 'status_change' | 'mention';
  ticket_id: number | null;
  ticket?: Ticket;
  read: boolean;
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
