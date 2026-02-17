import { NavLink, useNavigate, Link } from 'react-router-dom';
import {
  Bug, LayoutDashboard, FolderKanban, Bell, LogOut, Menu, X, ChevronLeft, Users, CircleDot, AlertTriangle, Settings, UserCog,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import { statusLabel } from '../../lib/helpers';
import type { Ticket } from '../../types';

interface SidebarProps {
  unreadCount: number;
  myTickets: Ticket[];
}

export default function Sidebar({ unreadCount, myTickets }: SidebarProps) {
  const { profile, signOut } = useAuthContext();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  const canSeeTeam = profile?.role === 'admin' || profile?.role === 'po';
  const roleLabel = profile?.role === 'po' ? 'Product Owner' : profile?.role === 'admin' ? 'Admin' : 'Developer';

  const isAdmin = profile?.role === 'admin';

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    ...(canSeeTeam ? [{ to: '/team', icon: Users, label: 'Team' }] : []),
    { to: '/notifications', icon: Bell, label: 'Notifications' },
    ...(isAdmin ? [{ to: '/admin/users', icon: UserCog, label: 'Users' }] : []),
    ...(isAdmin ? [{ to: '/settings', icon: Settings, label: 'Settings' }] : []),
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-200">
        <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Bug className="w-5 h-5 text-white" />
        </div>
        {!collapsed && <span className="text-lg font-bold text-slate-900">BugFlow</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto hidden lg:flex w-7 h-7 items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 transition"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto lg:hidden w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
            {item.label === 'Notifications' && unreadCount > 0 && (
              <span className={`${collapsed ? '' : 'ml-auto'} bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 font-medium`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {!collapsed && myTickets.length > 0 && (
        <div className="border-t border-slate-200 px-3 py-3 flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Tasks</span>
            <span className="text-xs font-medium text-slate-400">{myTickets.length}</span>
          </div>
          <div className="space-y-0.5 overflow-y-auto flex-1 min-h-0">
            {myTickets.map(t => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                onClick={() => setMobileOpen(false)}
                className="flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 transition group"
              >
                <TaskStatusIcon status={t.status} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 truncate group-hover:text-teal-700 transition">
                    #{t.id} {t.title}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {(t.project as unknown as { name: string })?.name} &middot; {statusLabel(t.status)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {collapsed && myTickets.length > 0 && (
        <div className="border-t border-slate-200 px-3 py-3 flex items-center justify-center">
          <Link
            to="/"
            className="w-8 h-8 bg-teal-50 text-teal-700 rounded-lg flex items-center justify-center text-xs font-bold hover:bg-teal-100 transition"
            title={`${myTickets.length} assigned tickets`}
          >
            {myTickets.length}
          </Link>
        </div>
      )}

      <div className="border-t border-slate-200 px-3 py-4 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-slate-600">
              {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{profile?.full_name || profile?.email}</p>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition w-full"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm"
      >
        <Menu className="w-5 h-5 text-slate-600" />
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 ${
          collapsed ? 'w-[72px]' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

function TaskStatusIcon({ status }: { status: string }) {
  if (status === 'blocked') return <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />;
  if (status === 'in_progress') return <CircleDot className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />;
  if (status === 'testing') return <CircleDot className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0 mt-0.5" />;
  return <CircleDot className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />;
}
