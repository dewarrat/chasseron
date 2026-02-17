import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus, Users, Ticket } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { slugify } from '../lib/helpers';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import type { Project, Profile } from '../types';

interface ProjectWithCounts extends Project {
  member_count: number;
  open_ticket_count: number;
}

export default function ProjectsPage() {
  const { profile } = useAuthContext();
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [availableOwners, setAvailableOwners] = useState<Profile[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const canCreate = profile?.role === 'po' || profile?.role === 'admin';

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    const { data: projs } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (!projs) { setLoading(false); return; }

    const enriched: ProjectWithCounts[] = [];
    for (const p of projs) {
      const { count: mc } = await supabase.from('project_members').select('*', { count: 'exact', head: true }).eq('project_id', p.id);
      const { count: tc } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('project_id', p.id).in('status', ['open', 'in_progress', 'blocked', 'testing']);
      enriched.push({ ...p, member_count: mc ?? 0, open_ticket_count: tc ?? 0 });
    }
    setProjects(enriched);
    setLoading(false);
  }

  async function openCreateModal() {
    const { data: owners } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'po'])
      .eq('is_active', true)
      .order('full_name');
    setAvailableOwners(owners ?? []);
    if (profile && (profile.role === 'admin' || profile.role === 'po')) {
      setOwnerId(profile.id);
    }
    setShowCreate(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !ownerId) return;
    setCreating(true);
    setCreateError('');
    const slug = slugify(name) || `project-${Date.now()}`;
    const { data: project, error } = await supabase
      .from('projects')
      .insert({ name, slug, description, created_by: profile.id })
      .select()
      .maybeSingle();

    if (error) {
      setCreateError(error.message || 'Failed to create project. Please try again.');
      setCreating(false);
      return;
    }

    if (project) {
      const { error: memberError } = await supabase.from('project_members').insert({
        project_id: project.id,
        user_id: ownerId,
        role: 'po',
      });
      if (memberError) {
        setCreateError(memberError.message || 'Project created but failed to add owner as a member.');
        setCreating(false);
        return;
      }
      setShowCreate(false);
      setName('');
      setDescription('');
      setOwnerId('');
      loadProjects();
    }
    setCreating(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your team's projects and bug tracking</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition"
          >
            <Plus className="w-4 h-4" />
            New project
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description={canCreate ? "Create your first project to start tracking bugs." : "You haven't been added to any projects yet."}
          action={canCreate ? (
            <button onClick={openCreateModal} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition">
              Create project
            </button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map(p => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-slate-300 transition group"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition">
                  <FolderKanban className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{p.name}</h3>
                  <p className="text-xs text-slate-500 truncate">{p.slug}</p>
                </div>
              </div>
              {p.description && (
                <p className="text-sm text-slate-600 line-clamp-2 mb-4">{p.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {p.member_count} members</span>
                <span className="flex items-center gap-1"><Ticket className="w-3.5 h-3.5" /> {p.open_ticket_count} open</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Project">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Project name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="e.g. Mobile App"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              placeholder="Brief description of the project..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Owner</label>
            <select
              value={ownerId}
              onChange={e => setOwnerId(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select an owner...</option>
              {availableOwners.map(owner => (
                <option key={owner.id} value={owner.id}>
                  {owner.full_name || owner.email} ({owner.role === 'admin' ? 'Admin' : 'PO'})
                </option>
              ))}
            </select>
          </div>
          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">
              {createError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={creating} className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50">
              {creating ? 'Creating...' : 'Create project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
