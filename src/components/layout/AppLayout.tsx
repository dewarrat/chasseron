import { Outlet } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { registerFcmToken, setupForegroundMessages } from '../../lib/firebase';
import type { Ticket } from '../../types';

export default function AppLayout() {
  const { user } = useAuthContext();
  const [unreadCount, setUnreadCount] = useState(0);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);

  const fetchMyTickets = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tickets')
      .select('*, project:projects(*)')
      .eq('assigned_to', user!.id)
      .not('status', 'eq', 'resolved')
      .order('updated_at', { ascending: false });
    setMyTickets(data ?? []);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    registerFcmToken(user.id).catch(() => {});
    const cleanupMessages = setupForegroundMessages((payload) => {
      if (Notification.permission === 'granted') {
        new Notification(payload.title, {
          body: payload.body,
          icon: '/vite.svg',
        });
      }
    });
    return () => cleanupMessages();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    async function fetchCount() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('is_read', false);
      setUnreadCount(count ?? 0);
    }

    fetchCount();
    fetchMyTickets();

    const channel = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          fetchMyTickets();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, fetchMyTickets]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar unreadCount={unreadCount} myTickets={myTickets} />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
