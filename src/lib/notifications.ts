import { supabase } from './supabase';
import type { NotificationType } from '../types';

export async function createNotification(
  userId: string,
  ticketId: number,
  type: NotificationType,
  message: string
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    ticket_id: ticketId,
    type,
    message,
  });
}

export async function notifyProjectPOs(
  projectId: string,
  ticketId: number,
  type: NotificationType,
  message: string
) {
  const { data: poMembers } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('role', 'po');

  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true);

  const userIds = new Set<string>();
  poMembers?.forEach(m => userIds.add(m.user_id));
  admins?.forEach(a => userIds.add(a.id));

  for (const userId of userIds) {
    await createNotification(userId, ticketId, type, message);
  }
}

export async function addSystemComment(
  ticketId: number,
  authorId: string,
  body: string
) {
  await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    author_id: authorId,
    body,
    is_system_generated: true,
  });
}
