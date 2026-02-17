import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Shield, Code2, Briefcase, UserX, UserCheck, AlertTriangle, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { createNotification, addSystemComment } from '../lib/notifications';
import Modal from '../components/ui/Modal';
import type { Profile, Ticket, Role } from '../types';

type FilterRole = 'all' | 'po' | 'developer' | 'admin';
type FilterStatus = 'all' | 'active' | 'inactive';

const roleConfig: Record<string, { label: string; icon: typeof Shield; color: string; bgColor: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'text-rose-700', bgColor: 'bg-rose-50' },
  po: { label: 'Product Owner', icon: Briefcase, color: 'text-teal-700', bgColor: 'bg-teal-50' },
  developer: { label: 'Developer', icon: Code2, color: 'text-blue-700', bgColor: 'bg-blue-50' },
};

export default function UserManagementPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterRole>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('active');
  const [search, setSearch] = useState('');
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const [showEditRole, setShowEditRole] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [editRoleVal, setEditRoleVal] = useState<Role>('developer');
  const [reactivateRole, setReactivateRole] = useState<Role>('developer');

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      navigate('/', { replace: true });
      return;
    }
    loadProfiles();
  }, [profile, navigate]);

  async function loadProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('role')
      .order('full_name');
    setProfiles(data ?? []);
    setLoading(false);
  }

  async function openDeactivateModal(user: Profile) {
    setSelectedUser(user);
    const { data: tickets } = await supabase
      .from('tickets')
      .select('*, project:projects(name, id)')
      .eq('assigned_to', user.id)
      .in('status', ['open', 'in_progress', 'blocked', 'testing']);
    setActiveTickets(tickets ?? []);
    setShowDeactivate(true);
  }

  async function handleDeactivate() {
    if (!selectedUser || !profile) return;
    setActionLoading(true);

    await supabase
      .from('profiles')
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq('id', selectedUser.id);

    if (activeTickets.length > 0) {
      const projectIds = [...new Set(activeTickets.map(t => t.project_id))];

      for (const projectId of projectIds) {
        const { data: poMembers } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId)
          .eq('role', 'po');

        const projectTickets = activeTickets.filter(t => t.project_id === projectId);

        if (poMembers && poMembers.length > 0) {
          for (const po of poMembers) {
            const tasks = projectTickets.map(t => ({
              ticket_id: t.id,
              project_owner_id: po.user_id,
              deactivated_user_id: selectedUser.id,
            }));
            await supabase.from('reassignment_tasks').insert(tasks);

            for (const t of projectTickets) {
              await createNotification(
                po.user_id,
                t.id,
                'reassignment_needed',
                `User ${selectedUser.full_name} was deactivated. Ticket #${t.id} "${t.title}" needs to be reassigned.`
              );
            }
          }
        }

        for (const t of projectTickets) {
          await addSystemComment(
            t.id,
            profile.id,
            `${selectedUser.full_name || selectedUser.email} was deactivated. This ticket needs to be reassigned by the project owner.`
          );
        }
      }
    }

    setShowDeactivate(false);
    setSelectedUser(null);
    setActiveTickets([]);
    setActionLoading(false);
    loadProfiles();
  }

  async function handleReactivate() {
    if (!selectedUser) return;
    setActionLoading(true);

    await supabase
      .from('profiles')
      .update({ is_active: true, deactivated_at: null, role: reactivateRole })
      .eq('id', selectedUser.id);

    setShowReactivate(false);
    setSelectedUser(null);
    setActionLoading(false);
    loadProfiles();
  }

  async function handleRoleChange() {
    if (!selectedUser) return;
    setActionLoading(true);

    await supabase
      .from('profiles')
      .update({ role: editRoleVal })
      .eq('id', selectedUser.id);

    setShowEditRole(false);
    setSelectedUser(null);
    setActionLoading(false);
    loadProfiles();
  }

  const filtered = profiles.filter(p => {
    if (filter !== 'all' && p.role !== filter) return false;
    if (statusFilter === 'active' && !p.is_active) return false;
    if (statusFilter === 'inactive' && p.is_active) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: profiles.length,
    active: profiles.filter(p => p.is_active).length,
    inactive: profiles.filter(p => !p.is_active).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Users className="w-6 h-6 text-teal-600" />
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        </div>
        <p className="text-sm text-slate-500 ml-9">Manage user accounts, roles, and access</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { value: 'active' as FilterStatus, label: `Active (${counts.active})` },
            { value: 'inactive' as FilterStatus, label: `Inactive (${counts.inactive})` },
            { value: 'all' as FilterStatus, label: `All (${counts.all})` },
          ]).map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === f.value
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { value: 'all' as FilterRole, label: 'All Roles' },
            { value: 'admin' as FilterRole, label: 'Admin' },
            { value: 'po' as FilterRole, label: 'PO' },
            { value: 'developer' as FilterRole, label: 'Dev' },
          ]).map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f.value
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No users found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-3 text-left font-medium text-slate-500">User</th>
                <th className="px-5 py-3 text-left font-medium text-slate-500 w-40">Role</th>
                <th className="px-5 py-3 text-left font-medium text-slate-500 w-28">Status</th>
                <th className="px-5 py-3 text-left font-medium text-slate-500 w-32">Joined</th>
                <th className="px-5 py-3 text-right font-medium text-slate-500 w-44">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => {
                const cfg = roleConfig[p.role] || roleConfig.developer;
                const RoleIcon = cfg.icon;
                const isSelf = p.id === profile?.id;
                return (
                  <tr key={p.id} className={`transition ${!p.is_active ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${!p.is_active ? 'bg-slate-200' : 'bg-slate-100'}`}>
                          <span className={`text-sm font-semibold ${!p.is_active ? 'text-slate-400' : 'text-slate-600'}`}>
                            {p.full_name?.[0]?.toUpperCase() || p.email[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className={`font-medium truncate ${!p.is_active ? 'text-slate-400' : 'text-slate-900'}`}>
                            {p.full_name || 'Unnamed'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${cfg.bgColor} ${cfg.color}`}>
                          <RoleIcon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                        {!isSelf && p.is_active && (
                          <button
                            onClick={() => { setSelectedUser(p); setEditRoleVal(p.role); setShowEditRole(true); }}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
                            title="Change role"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-500 text-xs">
                      {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {!isSelf && (
                        <div className="flex items-center justify-end gap-2">
                          {p.is_active ? (
                            <button
                              onClick={() => openDeactivateModal(p)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => { setSelectedUser(p); setReactivateRole(p.role); setShowReactivate(true); }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Reactivate
                            </button>
                          )}
                        </div>
                      )}
                      {isSelf && (
                        <span className="text-xs text-slate-400">You</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showDeactivate} onClose={() => { setShowDeactivate(false); setSelectedUser(null); }} title="Deactivate User">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to deactivate <span className="font-semibold">{selectedUser?.full_name || selectedUser?.email}</span>?
          </p>
          <p className="text-sm text-slate-500">
            This user will no longer be able to access the system and will be hidden from active team lists and assignment dropdowns.
            They will still appear in historical data (past comments, ticket history).
          </p>

          {activeTickets.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    This user has {activeTickets.length} active ticket{activeTickets.length > 1 ? 's' : ''} assigned
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    The project owners will receive reassignment tasks for each ticket.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {activeTickets.map(t => (
                      <li key={t.id} className="text-xs text-amber-700">
                        #{t.id} - {t.title} ({(t.project as any)?.name || 'Unknown project'})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowDeactivate(false); setSelectedUser(null); }}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivate}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
            >
              {actionLoading ? 'Deactivating...' : 'Deactivate user'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showReactivate} onClose={() => { setShowReactivate(false); setSelectedUser(null); }} title="Reactivate User">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Reactivate <span className="font-semibold">{selectedUser?.full_name || selectedUser?.email}</span> and restore their access to the system.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
            <select
              value={reactivateRole}
              onChange={e => setReactivateRole(e.target.value as Role)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="developer">Developer</option>
              <option value="po">Product Owner</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-xs text-slate-500 mt-1.5">You can assign a new role when reactivating this user.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowReactivate(false); setSelectedUser(null); }}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleReactivate}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
            >
              {actionLoading ? 'Reactivating...' : 'Reactivate user'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showEditRole} onClose={() => { setShowEditRole(false); setSelectedUser(null); }} title="Change User Role">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Change the role for <span className="font-semibold">{selectedUser?.full_name || selectedUser?.email}</span>.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New Role</label>
            <select
              value={editRoleVal}
              onChange={e => setEditRoleVal(e.target.value as Role)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="developer">Developer</option>
              <option value="po">Product Owner</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => { setShowEditRole(false); setSelectedUser(null); }}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleRoleChange}
              disabled={actionLoading || editRoleVal === selectedUser?.role}
              className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : 'Update role'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
