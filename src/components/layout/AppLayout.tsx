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
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, project:projects(*)')
        .eq('assigned_to', user!.id)
        .not('status', 'eq', 'resolved')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching tickets:', error);
        return;
      }

      setMyTickets(data ?? []);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Delay FCM registration significantly to avoid blocking page load
    const timer = setTimeout(() => {
      registerFcmToken(user.id).catch(() => {
        // Silently fail - Firebase may not be configured for this domain
      });
    }, 3000);

    let cleanupMessages: (() => void) | null = null;

    // Delay foreground message setup as well
    const messageTimer = setTimeout(() => {
      try {
        cleanupMessages = setupForegroundMessages((payload) => {
          try {
            if (Notification.permission === 'granted') {
              new Notification(payload.title, {
                body: payload.body,
                icon: '/vite.svg',
              });
            }
          } catch (err) {
            // Silently fail
          }
        });
      } catch (err) {
        // Silently fail
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(messageTimer);
      if (cleanupMessages) {
        try {
          cleanupMessages();
        } catch (err) {
          // Silently fail
        }
      }
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    async function fetchCount() {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .eq('is_read', false);

        if (error) {
          console.error('Error fetching notification count:', error);
          return;
        }

        setUnreadCount(count ?? 0);
      } catch (err) {
        console.error('Failed to fetch notification count:', err);
      }
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
