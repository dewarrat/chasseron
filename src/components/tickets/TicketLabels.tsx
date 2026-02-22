import { useState, useEffect } from 'react';
import { Tag, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Label, TicketLabel } from '../../types';

interface TicketLabelsProps {
  ticketId: number;
  projectId: string;
  canManage: boolean;
}

export default function TicketLabels({ ticketId, projectId, canManage }: TicketLabelsProps) {
  const [ticketLabels, setTicketLabels] = useState<TicketLabel[]>([]);
  const [projectLabels, setProjectLabels] = useState<Label[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadLabels();
  }, [ticketId, projectId]);

  async function loadLabels() {
    const [{ data: tl }, { data: pl }] = await Promise.all([
      supabase.from('ticket_labels').select('*, label:labels(*)').eq('ticket_id', ticketId),
      supabase.from('labels').select('*').eq('project_id', projectId).order('name'),
    ]);
    setTicketLabels(tl ?? []);
    setProjectLabels(pl ?? []);
  }

  async function addLabel(labelId: string) {
    await supabase.from('ticket_labels').insert({ ticket_id: ticketId, label_id: labelId });
    setShowAdd(false);
    loadLabels();
  }

  async function removeLabel(tlId: string) {
    await supabase.from('ticket_labels').delete().eq('id', tlId);
    loadLabels();
  }

  const attachedIds = new Set(ticketLabels.map(tl => tl.label_id));
  const available = projectLabels.filter(l => !attachedIds.has(l.id));

  if (ticketLabels.length === 0 && !canManage) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag className="w-3.5 h-3.5 text-slate-400" />
      {ticketLabels.map(tl => (
        <span
          key={tl.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: tl.label?.color || '#64748b' }}
        >
          {tl.label?.name}
          {canManage && (
            <button
              onClick={() => removeLabel(tl.id)}
              className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-black/20 transition"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      ))}
      {canManage && available.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <Plus className="w-3 h-3" />
          </button>
          {showAdd && (
            <div className="absolute top-8 left-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]">
              {available.map(l => (
                <button
                  key={l.id}
                  onClick={() => addLabel(l.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 transition text-left"
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
