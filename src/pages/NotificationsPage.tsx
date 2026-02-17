import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Ticket, UserPlus, UserMinus, MessageSquare, ShieldAlert, GitBranch, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { timeAgo } from '../lib/helpers';
import EmptyState from '../components/ui/EmptyState';
import type { Notification, NotificationType } from '../types';

const typeIcons: Record<NotificationType, typeof Bell> = {
  assigned: UserPlus,
  unassigned: UserMinus,
  status_changed: GitBranch,
  commented: MessageSquare,
  cancellation_requested: ShieldAlert,
  mentioned: Ticket,
  reassignment_needed: UserX,
};

export default function NotificationsPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { loadNotifications(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function loadNotifications() {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setNotifications(data ?? []);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  function handleClick(n: Notification) {
    if (!n.is_read) markAsRead(n.id);
    if (n.ticket_id) navigate(`/tickets/${n.ticket_id}`);
  }

  const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;
  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 rounded-lg transition">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${filter === 'all' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${filter === 'unread' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? 'All caught up' : 'No notifications'}
          description={filter === 'unread' ? 'You have no unread notifications.' : 'Notifications will appear here when things happen on your tickets.'}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {filtered.map(n => {
            const Icon = typeIcons[n.type] || Bell;
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 transition ${!n.is_read ? 'bg-teal-50/40' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${!n.is_read ? 'bg-teal-100' : 'bg-slate-100'}`}>
                  <Icon className={`w-4 h-4 ${!n.is_read ? 'text-teal-600' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.is_read ? 'font-medium text-slate-900' : 'text-slate-600'}`}>{n.message}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <div
                    onClick={e => { e.stopPropagation(); markAsRead(n.id); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-teal-600 flex-shrink-0 transition cursor-pointer"
                    title="Mark as read"
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); markAsRead(n.id); } }}
                  >
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
