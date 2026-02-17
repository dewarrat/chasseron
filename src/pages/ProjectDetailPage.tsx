import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, UserPlus, Trash2, Settings, Ticket, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { createNotification } from '../lib/notifications';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import ProjectSettings from '../components/projects/ProjectSettings';
import { statusLabel, statusColor, priorityLabel, priorityColor, timeAgo, slaTimeRemaining } from '../lib/helpers';
import type { Project, ProjectMember, Ticket as TTicket, Profile, Label } from '../types';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tickets, setTickets] = useState<TTicket[]>([]);
  const [tab, setTab] = useState<'tickets' | 'members' | 'settings'>('tickets');
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('p2_medium');
  const [newAssignee, setNewAssignee] = useState('');
  const [newReportLink, setNewReportLink] = useState('');
  const [newLabelIds, setNewLabelIds] = useState<string[]>([]);
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [adminUsers, setAdminUsers] = useState<Profile[]>([]);
  const [poUsers, setPoUsers] = useState<Profile[]>([]);
  const [creatingTicket, setCreatingTicket] = useState(false);

  const isPOorAdmin = profile?.role === 'admin' || profile?.role === 'po' || members.some(m => m.user_id === profile?.id && m.role === 'po');

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    const { data: p } = await supabase.from('projects').select('*, owner:profiles!projects_created_by_fkey(*)').eq('id', projectId).maybeSingle();
    setProject(p);

    const { data: mems } = await supabase
      .from('project_members')
      .select('*, profiles(*)')
      .eq('project_id', projectId)
      .eq('role', 'developer');
    setMembers(mems ?? []);

    const { data: tix } = await supabase
      .from('tickets')
      .select('*, assignee:profiles!tickets_assigned_to_fkey(*), creator:profiles!tickets_created_by_fkey(*), ticket_labels(*, label:labels(*))')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    setTickets(tix ?? []);

    const [{ data: lbls }, { data: admins }, { data: pos }] = await Promise.all([
      supabase.from('labels').select('*').eq('project_id', projectId).order('name'),
      supabase.from('profiles').select('*').eq('role', 'admin').eq('is_active', true),
      supabase.from('profiles').select('*').eq('role', 'po').eq('is_active', true),
    ]);
    setProjectLabels(lbls ?? []);
    setAdminUsers(admins ?? []);
    setPoUsers(pos ?? []);

    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadProject(); }, [loadProject]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !selectedUserId) return;
    await supabase.from('project_members').insert({
      project_id: projectId,
      user_id: selectedUserId,
      role: 'developer',
    });
    setShowAddMember(false);
    setSelectedUserId('');
    loadProject();
  }

  async function handleRemoveMember(memberId: string) {
    await supabase.from('project_members').delete().eq('id', memberId);
    loadProject();
  }

  async function openAddMember() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'developer').eq('is_active', true).order('full_name');
    setAllUsers(data ?? []);
    setShowAddMember(true);
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !profile) return;
    setCreatingTicket(true);
    const maxSort = tickets.length > 0 ? Math.max(...tickets.map(t => t.sort_order)) + 1 : 0;
    const { data: ticket } = await supabase.from('tickets').insert({
      project_id: projectId,
      title: newTitle,
      description: newDesc,
      priority: newPriority,
      assigned_to: newAssignee || null,
      report_link: newReportLink.trim() || null,
      created_by: profile.id,
      sort_order: maxSort,
    }).select().maybeSingle();

    if (ticket) {
      if (newAssignee) {
        await createNotification(newAssignee, ticket.id, 'assigned', `You were assigned to ticket #${ticket.id}: ${newTitle}`);
      }
      if (newLabelIds.length > 0) {
        await supabase.from('ticket_labels').insert(
          newLabelIds.map(labelId => ({ ticket_id: ticket.id, label_id: labelId }))
        );
      }
    }

    setShowCreateTicket(false);
    setNewTitle('');
    setNewDesc('');
    setNewPriority('p2_medium');
    setNewAssignee('');
    setNewReportLink('');
    setNewLabelIds([]);
    setCreatingTicket(false);
    loadProject();
  }

  const activeMembers = members.filter(m => (m.profiles as unknown as Profile)?.is_active !== false);
  const inactiveMembers = members.filter(m => (m.profiles as unknown as Profile)?.is_active === false);
  const displayMembers = [
    ...(project && (project as any).owner ? [{
      id: 'owner',
      user_id: (project as any).owner.id,
      role: 'owner',
      profiles: (project as any).owner,
    }] : []),
    ...activeMembers,
    ...inactiveMembers,
  ];

  const filtered = tickets.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function moveTicket(ticketId: number, direction: 'up' | 'down') {
    const idx = filtered.findIndex(t => t.id === ticketId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= filtered.length) return;
    const current = filtered[idx];
    const swap = filtered[swapIdx];
    await supabase.from('tickets').update({ sort_order: swap.sort_order }).eq('id', current.id);
    await supabase.from('tickets').update({ sort_order: current.sort_order }).eq('id', swap.id);
    loadProject();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;
  }

  if (!project) {
    return <div className="text-center py-16 text-slate-500">Project not found</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <button onClick={() => navigate('/projects')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition">
        <ArrowLeft className="w-4 h-4" /> Back to projects
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          {project.description && <p className="text-sm text-slate-500 mt-1">{project.description}</p>}
        </div>
        <button
          onClick={() => setShowCreateTicket(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition"
        >
          <Plus className="w-4 h-4" /> New ticket
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {(['tickets', 'members', 'settings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition capitalize ${
              tab === t ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'tickets' && <span className="inline-flex items-center gap-1.5"><Ticket className="w-4 h-4" />{t} ({tickets.length})</span>}
            {t === 'members' && <span className="inline-flex items-center gap-1.5"><Users className="w-4 h-4" />{t} ({displayMembers.length})</span>}
            {t === 'settings' && <span className="inline-flex items-center gap-1.5"><Settings className="w-4 h-4" />{t}</span>}
          </button>
        ))}
      </div>

      {tab === 'tickets' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="testing">Testing</option>
              <option value="resolved">Resolved</option>
              <option value="cancelled">Cancelled</option>
              <option value="duplicate">Duplicate</option>
            </select>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All priorities</option>
              <option value="p0_critical">P0 Critical</option>
              <option value="p1_high">P1 High</option>
              <option value="p2_medium">P2 Medium</option>
              <option value="p3_low">P3 Low</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
              No tickets found
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {isPOorAdmin && <th className="px-4 py-3 text-left font-medium text-slate-500 w-20">Order</th>}
                      <th className="px-4 py-3 text-left font-medium text-slate-500 w-16">ID</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Title</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500 w-28">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500 w-28">Priority</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500 w-36">Assignee</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500 w-28">SLA</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500 w-24">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((t, idx) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition">
                        {isPOorAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => { e.preventDefault(); moveTicket(t.id, 'up'); }}
                                disabled={idx === 0}
                                className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent text-xs"
                              >
                                ↑
                              </button>
                              <button
                                onClick={(e) => { e.preventDefault(); moveTicket(t.id, 'down'); }}
                                disabled={idx === filtered.length - 1}
                                className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent text-xs"
                              >
                                ↓
                              </button>
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-3 text-slate-500">#{t.id}</td>
                        <td className="px-4 py-3">
                          <Link to={`/tickets/${t.id}`} className="font-medium text-slate-900 hover:text-teal-700 transition">
                            {t.title}
                          </Link>
                          {(t as any).ticket_labels?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(t as any).ticket_labels.map((tl: any) => tl.label && (
                                <span
                                  key={tl.id}
                                  className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                                  style={{ backgroundColor: tl.label.color }}
                                >
                                  {tl.label.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3"><Badge className={statusColor(t.status)}>{statusLabel(t.status)}</Badge></td>
                        <td className="px-4 py-3"><Badge className={priorityColor(t.priority)}>{priorityLabel(t.priority)}</Badge></td>
                        <td className="px-4 py-3 text-slate-600">
                          {t.assignee ? (
                            <span className="flex items-center gap-1.5">
                              <span className={t.assignee.is_active === false ? 'text-slate-400' : ''}>{t.assignee.full_name}</span>
                              {t.assignee.is_active === false && (
                                <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-slate-200 text-slate-500">Inactive</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={
                            slaTimeRemaining(t.sla_deadline, t.blocked_at) === 'Overdue' ? 'text-red-600 font-medium' :
                            slaTimeRemaining(t.sla_deadline, t.blocked_at) === 'Paused' ? 'text-amber-600' : 'text-slate-500'
                          }>
                            {slaTimeRemaining(t.sla_deadline, t.blocked_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{timeAgo(t.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'members' && (
        <div>
          {isPOorAdmin && (
            <div className="mb-4">
              <button onClick={openAddMember} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition">
                <UserPlus className="w-4 h-4" /> Add member
              </button>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {displayMembers.map(m => {
              const memberProfile = m.profiles as unknown as Profile;
              const isInactive = memberProfile?.is_active === false;
              return (
                <div key={m.id} className={`flex items-center justify-between px-5 py-4 ${isInactive ? 'opacity-50 bg-slate-50/50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isInactive ? 'bg-slate-300' : 'bg-slate-200'}`}>
                      <span className={`text-sm font-medium ${isInactive ? 'text-slate-400' : 'text-slate-600'}`}>
                        {memberProfile?.full_name?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isInactive ? 'text-slate-400' : 'text-slate-900'}`}>{memberProfile?.full_name || memberProfile?.email}</p>
                        {isInactive && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-500">Inactive</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{memberProfile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={m.role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
                      {m.role === 'owner' ? 'Owner' : 'Developer'}
                    </Badge>
                    {isPOorAdmin && m.role !== 'owner' && m.user_id !== profile?.id && !isInactive && (
                      <button onClick={() => handleRemoveMember(m.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <ProjectSettings project={project} canEdit={isPOorAdmin} onProjectUpdated={loadProject} />
      )}

      <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Add Member">
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">User</label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select a user...</option>
              {allUsers.filter(u => !members.some(m => m.user_id === u.id)).map(u => (
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowAddMember(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition">Add member</button>
          </div>
        </form>
      </Modal>

      <Modal open={showCreateTicket} onClose={() => setShowCreateTicket(false)} title="Create Ticket">
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Bug title..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              placeholder="Describe the bug in detail..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Report Link <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="url"
              value={newReportLink}
              onChange={e => setNewReportLink(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="p0_critical">P0 Critical</option>
                <option value="p1_high">P1 High</option>
                <option value="p2_medium">P2 Medium</option>
                <option value="p3_low">P3 Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Assignee</label>
              <select
                value={newAssignee}
                onChange={e => setNewAssignee(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Unassigned</option>
                {adminUsers.filter(a => !members.some(m => m.user_id === a.id)).map(a => (
                  <option key={a.id} value={a.id}>{a.full_name || a.email} (Admin)</option>
                ))}
                {poUsers.filter(p => !members.some(m => m.user_id === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.full_name || p.email} (PO)</option>
                ))}
                {members.filter(m => (m.profiles as unknown as Profile)?.is_active !== false).map(m => (
                  <option key={m.user_id} value={m.user_id}>{(m.profiles as unknown as Profile)?.full_name || (m.profiles as unknown as Profile)?.email}</option>
                ))}
              </select>
            </div>
          </div>
          {projectLabels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Labels</label>
              <div className="flex flex-wrap gap-1.5">
                {projectLabels.map(l => {
                  const selected = newLabelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setNewLabelIds(prev =>
                        selected ? prev.filter(id => id !== l.id) : [...prev, l.id]
                      )}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        selected ? 'text-white ring-2 ring-offset-1' : 'text-white opacity-50 hover:opacity-75'
                      }`}
                      style={{
                        backgroundColor: l.color,
                        ...(selected ? { ringColor: l.color } : {}),
                      }}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreateTicket(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={creatingTicket} className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50">
              {creatingTicket ? 'Creating...' : 'Create ticket'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
