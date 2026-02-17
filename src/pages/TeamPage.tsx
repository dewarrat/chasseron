import { useState, useEffect } from 'react';
import { Users, Search, Shield, Code2, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

type FilterRole = 'all' | 'po' | 'developer' | 'admin';

const roleConfig: Record<string, { label: string; icon: typeof Shield; color: string; bgColor: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'text-rose-700', bgColor: 'bg-rose-50' },
  po: { label: 'Product Owner', icon: Briefcase, color: 'text-teal-700', bgColor: 'bg-teal-50' },
  developer: { label: 'Developer', icon: Code2, color: 'text-blue-700', bgColor: 'bg-blue-50' },
};

export default function TeamPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterRole>('all');
  const [search, setSearch] = useState('');

  useEffect(() => { loadProfiles(); }, []);

  async function loadProfiles() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('role')
      .order('full_name');
    setProfiles(data ?? []);
    setLoading(false);
  }

  const filtered = profiles.filter(p => {
    if (filter !== 'all' && p.role !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: profiles.length,
    admin: profiles.filter(p => p.role === 'admin').length,
    po: profiles.filter(p => p.role === 'po').length,
    developer: profiles.filter(p => p.role === 'developer').length,
  };

  const filters: { value: FilterRole; label: string }[] = [
    { value: 'all', label: `All (${counts.all})` },
    { value: 'po', label: `Product Owners (${counts.po})` },
    { value: 'developer', label: `Developers (${counts.developer})` },
    { value: 'admin', label: `Admins (${counts.admin})` },
  ];

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
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="text-sm text-slate-500 mt-1">All team members across projects</p>
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
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f.value
                  ? 'bg-teal-600 text-white'
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
          <p className="text-sm text-slate-500">No team members found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => {
            const cfg = roleConfig[p.role] || roleConfig.developer;
            const RoleIcon = cfg.icon;
            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-600">
                      {p.full_name?.[0]?.toUpperCase() || p.email[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">
                      {p.full_name || 'Unnamed'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{p.email}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${cfg.bgColor} ${cfg.color}`}>
                    <RoleIcon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    Joined {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
