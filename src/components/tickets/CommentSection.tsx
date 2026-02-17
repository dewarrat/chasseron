import { useState, useEffect } from 'react';
import { Send, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { timeAgo } from '../../lib/helpers';
import type { TicketComment } from '../../types';

interface CommentSectionProps {
  ticketId: number;
  onCommentAdded?: () => void;
}

export default function CommentSection({ ticketId, onCommentAdded }: CommentSectionProps) {
  const { profile } = useAuthContext();
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadComments() {
    const { data } = await supabase
      .from('ticket_comments')
      .select('*, author:profiles(*)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    setComments(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadComments(); }, [ticketId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !profile) return;
    setSubmitting(true);
    await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      author_id: profile.id,
      body: body.trim(),
      is_system_generated: false,
    });
    setBody('');
    setSubmitting(false);
    loadComments();
    onCommentAdded?.();
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Activity</h3>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full" /></div>
      ) : (
        <div className="space-y-4 mb-6">
          {comments.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">No activity yet</p>
          )}
          {comments.map(c => (
            <div key={c.id} className={`flex gap-3 ${c.is_system_generated ? 'items-start' : 'items-start'}`}>
              {c.is_system_generated ? (
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Activity className="w-4 h-4 text-slate-400" />
                </div>
              ) : (
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-teal-700">
                    {c.author?.full_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-medium ${c.is_system_generated ? 'text-slate-500' : 'text-slate-900'}`}>
                    {c.is_system_generated ? 'System' : (c.author?.full_name || c.author?.email)}
                  </span>
                  {!c.is_system_generated && c.author && 'is_active' in c.author && c.author.is_active === false && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-500">Inactive</span>
                  )}
                  <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
                </div>
                <p className={`text-sm ${c.is_system_generated ? 'text-slate-500 italic' : 'text-slate-700'}`}>
                  {c.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-medium text-teal-700">
            {profile?.full_name?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="w-9 h-9 flex items-center justify-center bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
