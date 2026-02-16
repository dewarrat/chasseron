import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Clock, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { GlobalSettings } from '../types';

const PRIORITY_META = [
  { key: 'sla_p0_hours' as const, label: 'P0 Critical', desc: 'Urgent production issues', color: 'border-red-200 bg-red-50' },
  { key: 'sla_p1_hours' as const, label: 'P1 High', desc: 'Major functionality broken', color: 'border-orange-200 bg-orange-50' },
  { key: 'sla_p2_hours' as const, label: 'P2 Medium', desc: 'Non-critical bugs', color: 'border-yellow-200 bg-yellow-50' },
  { key: 'sla_p3_hours' as const, label: 'P3 Low', desc: 'Minor issues, cosmetic', color: 'border-slate-200 bg-slate-50' },
];

function formatDuration(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

export default function SettingsPage() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [form, setForm] = useState({ sla_p0_hours: 4, sla_p1_hours: 24, sla_p2_hours: 168, sla_p3_hours: 720 });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      navigate('/', { replace: true });
      return;
    }

    async function load() {
      const { data } = await supabase
        .from('global_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (data) {
        setSettings(data);
        setForm({
          sla_p0_hours: data.sla_p0_hours,
          sla_p1_hours: data.sla_p1_hours,
          sla_p2_hours: data.sla_p2_hours,
          sla_p3_hours: data.sla_p3_hours,
        });
      }
      setLoading(false);
    }
    load();
  }, [profile, navigate]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    await supabase
      .from('global_settings')
      .update({
        sla_p0_hours: form.sla_p0_hours,
        sla_p1_hours: form.sla_p1_hours,
        sla_p2_hours: form.sla_p2_hours,
        sla_p3_hours: form.sla_p3_hours,
        updated_at: new Date().toISOString(),
      })
      .eq('id', settings.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const isDirty = settings && (
    form.sla_p0_hours !== settings.sla_p0_hours ||
    form.sla_p1_hours !== settings.sla_p1_hours ||
    form.sla_p2_hours !== settings.sla_p2_hours ||
    form.sla_p3_hours !== settings.sla_p3_hours
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Shield className="w-6 h-6 text-teal-600" />
          <h1 className="text-2xl font-bold text-slate-900">Admin Settings</h1>
        </div>
        <p className="text-sm text-slate-500 ml-9">Global configuration for your Alpi - Issue Tracking Workflow instance</p>
      </div>

      <form onSubmit={handleSave}>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Default SLA Deadlines</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-500 mb-6">
              Set the default resolution time for each priority level. These apply to all projects unless overridden at the project level.
            </p>
            <div className="grid gap-4">
              {PRIORITY_META.map(p => (
                <div key={p.key} className={`flex items-center justify-between p-4 rounded-lg border ${p.color}`}>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{p.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={8760}
                        value={form[p.key]}
                        onChange={e => setForm(prev => ({ ...prev, [p.key]: Number(e.target.value) || 1 }))}
                        className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                      />
                      <span className="text-sm text-slate-500 w-10">hours</span>
                    </div>
                    <span className="text-xs text-slate-400 w-14 text-right">{formatDuration(form[p.key])}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <p className="text-xs text-slate-400">
            Changes only affect newly created tickets. Existing ticket deadlines remain unchanged.
          </p>
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-teal-600 font-medium">Saved</span>}
            <button
              type="submit"
              disabled={saving || !isDirty}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
