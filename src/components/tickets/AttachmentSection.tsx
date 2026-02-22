import { useState, useEffect, useRef } from 'react';
import { Paperclip, Upload, Trash2, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthContext } from '../../contexts/AuthContext';
import { timeAgo } from '../../lib/helpers';
import type { TicketAttachment } from '../../types';

interface AttachmentSectionProps {
  ticketId: number;
  canUpload: boolean;
}

export default function AttachmentSection({ ticketId, canUpload }: AttachmentSectionProps) {
  const { profile } = useAuthContext();
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAttachments();
  }, [ticketId]);

  async function loadAttachments() {
    const { data } = await supabase
      .from('ticket_attachments')
      .select('*, uploader:profiles(*)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });
    setAttachments(data ?? []);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    const path = `tickets/${ticketId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(path, file);

    if (!uploadError) {
      await supabase.from('ticket_attachments').insert({
        ticket_id: ticketId,
        uploaded_by: profile.id,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
        storage_path: path,
      });
      loadAttachments();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDelete(attachment: TicketAttachment) {
    await supabase.storage.from('attachments').remove([attachment.storage_path]);
    await supabase.from('ticket_attachments').delete().eq('id', attachment.id);
    loadAttachments();
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <Paperclip className="w-4 h-4" /> Attachments ({attachments.length})
        </h3>
        {canUpload && (
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Uploading...' : 'Upload'}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">No attachments</p>
      ) : (
        <div className="space-y-2">
          {attachments.map(a => (
            <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{a.file_name}</p>
                  <p className="text-xs text-slate-400">
                    {formatSize(a.file_size)} &middot; {(a.uploader as any)?.full_name || 'Unknown'} &middot; {timeAgo(a.created_at)}
                  </p>
                </div>
              </div>
              {canUpload && (
                <button
                  onClick={() => handleDelete(a)}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
