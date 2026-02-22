import { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Project, Label } from '../../types';

interface ProjectSettingsProps {
  project: Project;
  canEdit: boolean;
  onProjectUpdated: () => void;
}

export default function ProjectSettings({ project, canEdit, onProjectUpdated }: ProjectSettingsProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [slaP0, setSlaP0] = useState(project.sla_p0_hours?.toString() ?? '');
  const [slaP1, setSlaP1] = useState(project.sla_p1_hours?.toString() ?? '');
  const [slaP2, setSlaP2] = useState(project.sla_p2_hours?.toString() ?? '');
  const [slaP3, setSlaP3] = useState(project.sla_p3_hours?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const [labels, setLabels] = useState<Label[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#64748b');

  useEffect(() => {
    loadLabels();
  }, [project.id]);

  async function loadLabels() {
    const { data } = await supabase
      .from('labels')
      .select('*')
      .eq('project_id', project.id)
      .order('name');
    setLabels(data ?? []);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    await supabase.from('projects').update({
      name,
      description,
      sla_p0_hours: slaP0 ? parseFloat(slaP0) : null,
      sla_p1_hours: slaP1 ? parseFloat(slaP1) : null,
      sla_p2_hours: slaP2 ? parseFloat(slaP2) : null,
      sla_p3_hours: slaP3 ? parseFloat(slaP3) : null,
    }).eq('id', project.id);
    setSaving(false);
    onProjectUpdated();
  }

  async function handleAddLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    await supabase.from('labels').insert({
      project_id: project.id,
      name: newLabelName.trim(),
      color: newLabelColor,
    });
    setNewLabelName('');
    setNewLabelColor('#64748b');
    loadLabels();
  }

  async function handleDeleteLabel(id: string) {
    await supabase.from('labels').delete().eq('id', id);
    loadLabels();
  }

  if (!canEdit) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
        You don't have permission to edit project settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">General</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
          />
        </div>

        <h3 className="text-sm font-semibold text-slate-900 pt-4">SLA Overrides (hours)</h3>
        <p className="text-xs text-slate-500">Leave blank to use global defaults.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'P0 Critical', value: slaP0, set: setSlaP0 },
            { label: 'P1 High', value: slaP1, set: setSlaP1 },
            { label: 'P2 Medium', value: slaP2, set: setSlaP2 },
            { label: 'P3 Low', value: slaP3, set: setSlaP3 },
          ].map(s => (
            <div key={s.label}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{s.label}</label>
              <input
                type="number"
                value={s.value}
                onChange={e => s.set(e.target.value)}
                min="0"
                step="any"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Global"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Labels</h3>

        <form onSubmit={handleAddLabel} className="flex items-end gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              type="text"
              value={newLabelName}
              onChange={e => setNewLabelName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Label name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
            <input
              type="color"
              value={newLabelColor}
              onChange={e => setNewLabelColor(e.target.value)}
              className="w-10 h-[38px] border border-slate-300 rounded-lg cursor-pointer"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>

        {labels.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No labels yet</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {labels.map(l => (
              <div
                key={l.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: l.color }}
              >
                {l.name}
                <button
                  onClick={() => handleDeleteLabel(l.id)}
                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-black/20 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
