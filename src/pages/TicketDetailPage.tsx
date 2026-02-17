import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, User, Clock, AlertTriangle, CheckCircle, XCircle, RotateCcw,
  Hand, Ban, FlaskConical, Copy, Pencil, ShieldAlert, ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import { createNotification, notifyProjectPOs, addSystemComment } from '../lib/notifications';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import CommentSection from '../components/tickets/CommentSection';
import TicketLabels from '../components/tickets/TicketLabels';
import AttachmentSection from '../components/tickets/AttachmentSection';
import TicketLifecycle from '../components/tickets/TicketLifecycle';
import {
  statusLabel, statusColor, priorityLabel, priorityColor, timeAgo,
  slaTimeRemaining, rejectionLabel,
} from '../lib/helpers';
import type { Ticket, Profile, ProjectMember, TicketPriority, RejectionReason } from '../types';

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { profile } = useAuthContext();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [adminProfiles, setAdminProfiles] = useState<Profile[]>([]);
  const [poProfiles, setPoProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [showUnclaim, setShowUnclaim] = useState(false);
  const [unclaimComment, setUnclaimComment] = useState('');

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState<RejectionReason>('not_a_bug');
  const [rejectComment, setRejectComment] = useState('');
  const [rejectDuplicateId, setRejectDuplicateId] = useState('');

  const [showAssign, setShowAssign] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');

  const [showEditPriority, setShowEditPriority] = useState(false);
  const [editPriorityVal, setEditPriorityVal] = useState<TicketPriority>('p2_medium');

  const [showBlock, setShowBlock] = useState(false);
  const [blockComment, setBlockComment] = useState('');

  const [showResolve, setShowResolve] = useState(false);
  const [resolveComment, setResolveComment] = useState('');

  const [showCancel, setShowCancel] = useState(false);
  const [cancelComment, setCancelComment] = useState('');

  const [showDuplicate, setShowDuplicate] = useState(false);
  const [duplicateId, setDuplicateId] = useState('');
  const [duplicateComment, setDuplicateComment] = useState('');

  const [showReopen, setShowReopen] = useState(false);
  const [reopenComment, setReopenComment] = useState('');

  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editReportLink, setEditReportLink] = useState('');

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    const { data: t } = await supabase
      .from('tickets')
      .select('*, assignee:profiles!tickets_assigned_to_fkey(*), creator:profiles!tickets_created_by_fkey(*), project:projects(*)')
      .eq('id', parseInt(ticketId))
      .maybeSingle();
    setTicket(t);

    if (t) {
      const [{ data: mems }, { data: admins }, { data: pos }] = await Promise.all([
        supabase.from('project_members').select('*, profiles(*)').eq('project_id', t.project_id),
        supabase.from('profiles').select('*').eq('role', 'admin').eq('is_active', true),
        supabase.from('profiles').select('*').eq('role', 'po').eq('is_active', true),
      ]);
      setMembers(mems ?? []);
      setAdminProfiles(admins ?? []);
      setPoProfiles(pos ?? []);
    }
    setLoading(false);
  }, [ticketId]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full" /></div>;
  }

  if (!ticket || !profile) {
    return <div className="text-center py-16 text-slate-500">Ticket not found</div>;
  }

  const isAssignee = ticket.assigned_to === profile.id;
  const isPO = profile.role === 'admin' || profile.role === 'po' || members.some(m => m.user_id === profile.id && m.role === 'po');
  const isAdmin = profile.role === 'admin';
  const isDev = isAdmin || profile.role === 'developer' || members.some(m => m.user_id === profile.id && m.role === 'developer');

  const canClaim = isDev && ticket.status === 'open' && !ticket.assigned_to;
  const canUnclaim = isDev && isAssignee && ticket.status === 'in_progress';
  const canMarkTesting = isDev && isAssignee && ticket.status === 'in_progress';
  const canReject = isDev && (ticket.status === 'in_progress' || ticket.status === 'open') && (isAssignee || !ticket.assigned_to);

  const canEditPriority = isPO;
  const canEditDetails = isPO;
  const canAssign = isPO;
  const canBlock = isPO && !['blocked', 'resolved', 'cancelled', 'duplicate'].includes(ticket.status);
  const canUnblock = isPO && ticket.status === 'blocked';
  const canResolve = isPO && !['resolved', 'cancelled', 'duplicate'].includes(ticket.status);
  const canReopen = isPO && ['resolved', 'cancelled', 'duplicate'].includes(ticket.status);
  const canCancel = isPO && !['cancelled', 'duplicate'].includes(ticket.status);
  const canMarkDuplicate = isPO && !['cancelled', 'duplicate'].includes(ticket.status);

  async function handleClaim() {
    setActionLoading(true);
    await supabase.from('tickets').update({ assigned_to: profile!.id, status: 'in_progress' }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} claimed this ticket`);
    await loadTicket();
    setActionLoading(false);
  }

  async function handleUnclaim(e: React.FormEvent) {
    e.preventDefault();
    if (!unclaimComment.trim()) return;
    setActionLoading(true);
    await supabase.from('tickets').update({ assigned_to: null, status: 'open' }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} returned this ticket to pool: "${unclaimComment.trim()}"`);
    await notifyProjectPOs(ticket!.project_id, ticket!.id, 'unassigned', `${profile!.full_name} returned ticket #${ticket!.id} to pool: "${unclaimComment.trim()}"`);
    setShowUnclaim(false);
    setUnclaimComment('');
    await loadTicket();
    setActionLoading(false);
  }

  async function handleMarkTesting() {
    setActionLoading(true);
    await supabase.from('tickets').update({ status: 'testing' }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} marked this ticket as ready for testing`);
    await loadTicket();
    setActionLoading(false);
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectComment.trim()) return;
    setActionLoading(true);
    const reasonLabel = rejectionLabel(rejectReason);
    const dupNote = rejectReason === 'duplicate' && rejectDuplicateId ? ` (duplicate of #${rejectDuplicateId})` : '';
    await supabase.from('tickets').update({
      status: 'blocked',
      assigned_to: null,
      rejection_reason: rejectReason,
    }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} requested cancellation — Reason: ${reasonLabel}${dupNote}. Comment: "${rejectComment.trim()}"`);
    await notifyProjectPOs(ticket!.project_id, ticket!.id, 'cancellation_requested', `${profile!.full_name} requested cancellation of ticket #${ticket!.id}: ${reasonLabel}${dupNote} — "${rejectComment.trim()}"`);
    setShowReject(false);
    setRejectComment('');
    setRejectReason('not_a_bug');
    setRejectDuplicateId('');
    await loadTicket();
    setActionLoading(false);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignUserId) return;
    setActionLoading(true);
    const prevAssignee = ticket!.assigned_to;
    const newStatus = ticket!.status === 'open' ? 'in_progress' : ticket!.status;
    await supabase.from('tickets').update({ assigned_to: assignUserId, status: newStatus }).eq('id', ticket!.id);
    const { data: assignedProfile } = await supabase.from('profiles').select('full_name, email').eq('id', assignUserId).maybeSingle();
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} assigned this ticket to ${assignedProfile?.full_name || assignedProfile?.email}`);
    await createNotification(assignUserId, ticket!.id, 'assigned', `You were assigned to ticket #${ticket!.id}: ${ticket!.title}`);
    if (prevAssignee && prevAssignee !== assignUserId) {
      await createNotification(prevAssignee, ticket!.id, 'unassigned', `You were unassigned from ticket #${ticket!.id}: ${ticket!.title}`);
    }
    setShowAssign(false);
    setAssignUserId('');
    await loadTicket();
    setActionLoading(false);
  }

  async function handleEditPriority(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    await supabase.from('tickets').update({ priority: editPriorityVal }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} changed priority to ${priorityLabel(editPriorityVal)}`);
    setShowEditPriority(false);
    await loadTicket();
    setActionLoading(false);
  }

  async function handleBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!blockComment.trim()) return;
    setActionLoading(true);
    await supabase.from('tickets').update({ status: 'blocked' }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} marked this ticket as blocked: "${blockComment.trim()}"`);
    setShowBlock(false);
    setBlockComment('');
    await loadTicket();
    setActionLoading(false);
  }

  async function handleUnblock() {
    setActionLoading(true);
    const newStatus = ticket!.assigned_to ? 'in_progress' : 'open';
    await supabase.from('tickets').update({ status: newStatus, rejection_reason: null }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} unblocked this ticket`);
    if (ticket!.assigned_to) {
      await createNotification(ticket!.assigned_to, ticket!.id, 'status_changed', `Ticket #${ticket!.id} was unblocked and is now ${newStatus}`);
    }
    await loadTicket();
    setActionLoading(false);
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    await supabase.from('tickets').update({ status: 'resolved' }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} resolved this ticket${resolveComment ? ': "' + resolveComment.trim() + '"' : ''}`);
    setShowResolve(false);
    setResolveComment('');
    await loadTicket();
    setActionLoading(false);
  }

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelComment.trim()) return;
    setActionLoading(true);
    await supabase.from('tickets').update({ status: 'cancelled', assigned_to: null }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} cancelled this ticket: "${cancelComment.trim()}"`);
    setShowCancel(false);
    setCancelComment('');
    await loadTicket();
    setActionLoading(false);
  }

  async function handleMarkDuplicate(e: React.FormEvent) {
    e.preventDefault();
    if (!duplicateComment.trim() || !duplicateId) return;
    setActionLoading(true);
    await supabase.from('tickets').update({ status: 'duplicate', duplicate_of: parseInt(duplicateId), assigned_to: null }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} marked this as duplicate of #${duplicateId}: "${duplicateComment.trim()}"`);
    setShowDuplicate(false);
    setDuplicateComment('');
    setDuplicateId('');
    await loadTicket();
    setActionLoading(false);
  }

  async function handleReopen(e: React.FormEvent) {
    e.preventDefault();
    if (!reopenComment.trim()) return;
    setActionLoading(true);
    await supabase.from('tickets').update({ status: 'open', assigned_to: null, duplicate_of: null, rejection_reason: null }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} reopened this ticket: "${reopenComment.trim()}"`);
    setShowReopen(false);
    setReopenComment('');
    await loadTicket();
    setActionLoading(false);
  }

  async function handleEditDetails(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    await supabase.from('tickets').update({ title: editTitle, description: editDesc, report_link: editReportLink.trim() || null }).eq('id', ticket!.id);
    await addSystemComment(ticket!.id, profile!.id, `${profile!.full_name || profile!.email} edited ticket details`);
    setShowEdit(false);
    await loadTicket();
    setActionLoading(false);
  }

  const slaText = slaTimeRemaining(ticket.sla_deadline, ticket.blocked_at);
  const slaUrgent = slaText === 'Overdue';
  const slaPaused = slaText === 'Paused';

  const devMembers = members.filter(m => m.role === 'developer' && (m.profiles as unknown as Profile)?.is_active !== false);
  const memberUserIds = new Set(devMembers.map(m => m.user_id));
  const assignableAdmins = adminProfiles.filter(a => !memberUserIds.has(a.id));
  const assignablePOs = poProfiles.filter(p => !memberUserIds.has(p.id));

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4 transition">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm text-slate-500 font-mono">#{ticket.id}</span>
              <Badge className={statusColor(ticket.status)}>{statusLabel(ticket.status)}</Badge>
              <Badge className={priorityColor(ticket.priority)}>{priorityLabel(ticket.priority)}</Badge>
              {ticket.rejection_reason && ticket.status === 'blocked' && (
                <Badge className="bg-orange-100 text-orange-700">Rejection: {rejectionLabel(ticket.rejection_reason)}</Badge>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-4">{ticket.title}</h1>
            <div className="prose prose-slate prose-sm max-w-none mb-4">
              <p className="text-slate-700 whitespace-pre-wrap">{ticket.description || 'No description provided.'}</p>
            </div>
            <TicketLabels ticketId={ticket.id} projectId={ticket.project_id} canManage={isPO || isAssignee} />
          </div>

          <AttachmentSection ticketId={ticket.id} canUpload={isPO || isDev} />

          <CommentSection ticketId={ticket.id} onCommentAdded={loadTicket} />
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Assignee</span>
                <span className="font-medium text-slate-900">
                  {ticket.assignee ? (
                    <span className="flex items-center gap-1.5">
                      {ticket.assignee.full_name}
                      {ticket.assignee.is_active === false && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-500">Inactive</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Reporter</span>
                <span className="font-medium text-slate-900">
                  <span className="flex items-center gap-1.5">
                    {ticket.creator?.full_name || ticket.creator?.email}
                    {ticket.creator?.is_active === false && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-500">Inactive</span>
                    )}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Created</span>
                <span className="text-slate-700">{timeAgo(ticket.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Updated</span>
                <span className="text-slate-700">{timeAgo(ticket.updated_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> SLA</span>
                <span className={`font-medium ${slaUrgent ? 'text-red-600' : slaPaused ? 'text-amber-600' : 'text-slate-700'}`}>{slaText}</span>
              </div>
              {ticket.duplicate_of && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Duplicate of</span>
                  <Link to={`/tickets/${ticket.duplicate_of}`} className="font-medium text-teal-600 hover:text-teal-700">#{ticket.duplicate_of}</Link>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Project</span>
                <Link to={`/projects/${ticket.project_id}`} className="font-medium text-teal-600 hover:text-teal-700">{ticket.project?.name}</Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Report Link</span>
                {ticket.report_link ? (
                  <a href={ticket.report_link} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-600 hover:text-teal-700 truncate max-w-[160px]">
                    {(() => { try { return new URL(ticket.report_link).hostname; } catch { return 'Link'; } })()}
                  </a>
                ) : (
                  <span className="text-slate-400">None</span>
                )}
              </div>
            </div>
          </div>

          <TicketLifecycle status={ticket.status} duplicateOf={ticket.duplicate_of} />

          {(isDev || isPO) && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Actions</h3>

              {canClaim && (
                <button onClick={handleClaim} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition disabled:opacity-50 mb-2">
                  <Hand className="w-4 h-4" /> Claim this ticket
                </button>
              )}

              {(canEditPriority || canEditDetails) && (
                <>
                  <div className="pt-3 pb-2 border-t border-slate-200 mt-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Ticket Actions</h4>
                  </div>
                  <div className="space-y-2">
                    {canEditPriority && (
                      <button onClick={() => { setEditPriorityVal(ticket.priority); setShowEditPriority(true); }} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition disabled:opacity-50">
                        <AlertTriangle className="w-4 h-4" /> Edit priority
                      </button>
                    )}

                    {canEditDetails && (
                      <button onClick={() => { setEditTitle(ticket.title); setEditDesc(ticket.description); setEditReportLink(ticket.report_link || ''); setShowEdit(true); }} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition disabled:opacity-50">
                        <Pencil className="w-4 h-4" /> Edit details
                      </button>
                    )}
                  </div>
                </>
              )}

              {(canMarkTesting || canUnclaim || canReject) && (
                <>
                  <div className="pt-3 pb-2 border-t border-slate-200 mt-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Workflow Standard</h4>
                  </div>
                  <div className="space-y-2">
                    {canMarkTesting && (
                      <button onClick={handleMarkTesting} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 transition disabled:opacity-50">
                        <FlaskConical className="w-4 h-4" /> Ready for testing
                      </button>
                    )}

                    {canUnclaim && (
                      <button onClick={() => setShowUnclaim(true)} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition disabled:opacity-50">
                        <RotateCcw className="w-4 h-4" /> Unclaim / Return to pool
                      </button>
                    )}

                    {canReject && (
                      <button onClick={() => setShowReject(true)} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition disabled:opacity-50">
                        <ShieldAlert className="w-4 h-4" /> Request cancellation / Reject
                      </button>
                    )}
                  </div>
                </>
              )}

              {(canAssign || canBlock || canUnblock || canResolve || canCancel || canMarkDuplicate || canReopen) && (
                <>
                  <div className="pt-3 pb-2 border-t border-slate-200 mt-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Workflow Special</h4>
                  </div>
                  <div className="space-y-2">
                    {canAssign && (
                      <button onClick={() => { setAssignUserId(ticket.assigned_to || ''); setShowAssign(true); }} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition disabled:opacity-50">
                        <User className="w-4 h-4" /> {ticket.assigned_to ? 'Reassign' : 'Assign'}
                      </button>
                    )}

                    {canBlock && (
                      <button onClick={() => setShowBlock(true)} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition disabled:opacity-50">
                        <Ban className="w-4 h-4" /> Mark as blocked
                      </button>
                    )}

                    {canUnblock && (
                      <button onClick={handleUnblock} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition disabled:opacity-50">
                        <CheckCircle className="w-4 h-4" /> Unblock
                      </button>
                    )}

                    {canResolve && (
                      <button onClick={() => setShowResolve(true)} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition disabled:opacity-50">
                        <CheckCircle className="w-4 h-4" /> Resolve
                      </button>
                    )}

                    {canCancel && (
                      <button onClick={() => setShowCancel(true)} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition disabled:opacity-50">
                        <XCircle className="w-4 h-4" /> Cancel ticket
                      </button>
                    )}

                    {canMarkDuplicate && (
                      <button onClick={() => setShowDuplicate(true)} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100 transition disabled:opacity-50">
                        <Copy className="w-4 h-4" /> Mark as duplicate
                      </button>
                    )}

                    {canReopen && (
                      <button onClick={() => setShowReopen(true)} disabled={actionLoading} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition disabled:opacity-50">
                        <RotateCcw className="w-4 h-4" /> Reopen
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={showUnclaim} onClose={() => setShowUnclaim(false)} title="Return Ticket to Pool">
        <form onSubmit={handleUnclaim} className="space-y-4">
          <p className="text-sm text-slate-600">Explain why you are returning this ticket. This will be visible to the Product Owner.</p>
          <textarea
            value={unclaimComment}
            onChange={e => setUnclaimComment(e.target.value)}
            required
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            placeholder="e.g. I don't have the right access for this..."
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowUnclaim(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition disabled:opacity-50">Return to pool</button>
          </div>
        </form>
      </Modal>

      <Modal open={showReject} onClose={() => setShowReject(false)} title="Request Cancellation / Reject">
        <form onSubmit={handleReject} className="space-y-4">
          <p className="text-sm text-slate-600">This will block the ticket and notify the Product Owner. Only the PO can make the final decision to cancel or close.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason</label>
            <select
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value as RejectionReason)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="not_a_bug">Not a Bug</option>
              <option value="cannot_reproduce">Cannot Reproduce</option>
              <option value="duplicate">Duplicate</option>
              <option value="other">Other</option>
            </select>
          </div>
          {rejectReason === 'duplicate' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Original ticket ID</label>
              <input
                type="number"
                value={rejectDuplicateId}
                onChange={e => setRejectDuplicateId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="e.g. 42"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Comment (required)</label>
            <textarea
              value={rejectComment}
              onChange={e => setRejectComment(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              placeholder="Explain why this ticket should be rejected..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowReject(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50">Submit rejection</button>
          </div>
        </form>
      </Modal>

      <Modal open={showAssign} onClose={() => setShowAssign(false)} title={ticket.assigned_to ? 'Reassign Ticket' : 'Assign Ticket'}>
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign to</label>
            <select
              value={assignUserId}
              onChange={e => setAssignUserId(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Select a team member...</option>
              {assignableAdmins.length > 0 && (
                <optgroup label="Admins">
                  {assignableAdmins.map(a => (
                    <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
                  ))}
                </optgroup>
              )}
              {assignablePOs.length > 0 && (
                <optgroup label="Product Owners">
                  {assignablePOs.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                  ))}
                </optgroup>
              )}
              {devMembers.length > 0 && (
                <optgroup label="Developers">
                  {devMembers.map(m => (
                    <option key={m.user_id} value={m.user_id}>{(m.profiles as unknown as Profile)?.full_name || (m.profiles as unknown as Profile)?.email}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowAssign(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50">Assign</button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditPriority} onClose={() => setShowEditPriority(false)} title="Edit Priority">
        <form onSubmit={handleEditPriority} className="space-y-4">
          <select
            value={editPriorityVal}
            onChange={e => setEditPriorityVal(e.target.value as TicketPriority)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="p0_critical">P0 Critical</option>
            <option value="p1_high">P1 High</option>
            <option value="p2_medium">P2 Medium</option>
            <option value="p3_low">P3 Low</option>
          </select>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowEditPriority(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={showBlock} onClose={() => setShowBlock(false)} title="Mark as Blocked">
        <form onSubmit={handleBlock} className="space-y-4">
          <textarea
            value={blockComment}
            onChange={e => setBlockComment(e.target.value)}
            required
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            placeholder="What is blocking this ticket?"
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowBlock(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50">Block ticket</button>
          </div>
        </form>
      </Modal>

      <Modal open={showResolve} onClose={() => setShowResolve(false)} title="Resolve Ticket">
        <form onSubmit={handleResolve} className="space-y-4">
          <textarea
            value={resolveComment}
            onChange={e => setResolveComment(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            placeholder="Optional: resolution notes..."
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowResolve(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">Resolve</button>
          </div>
        </form>
      </Modal>

      <Modal open={showCancel} onClose={() => setShowCancel(false)} title="Cancel Ticket">
        <form onSubmit={handleCancel} className="space-y-4">
          <p className="text-sm text-slate-600">This is a terminal action. Only a PO/Admin can reopen a cancelled ticket.</p>
          <textarea
            value={cancelComment}
            onChange={e => setCancelComment(e.target.value)}
            required
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            placeholder="Reason for cancellation..."
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowCancel(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Go back</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50">Cancel ticket</button>
          </div>
        </form>
      </Modal>

      <Modal open={showDuplicate} onClose={() => setShowDuplicate(false)} title="Mark as Duplicate">
        <form onSubmit={handleMarkDuplicate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Original ticket ID</label>
            <input
              type="number"
              value={duplicateId}
              onChange={e => setDuplicateId(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="e.g. 42"
            />
          </div>
          <textarea
            value={duplicateComment}
            onChange={e => setDuplicateComment(e.target.value)}
            required
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            placeholder="Explain the duplication..."
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowDuplicate(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2.5 bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50">Mark as duplicate</button>
          </div>
        </form>
      </Modal>

      <Modal open={showReopen} onClose={() => setShowReopen(false)} title="Reopen Ticket">
        <form onSubmit={handleReopen} className="space-y-4">
          <textarea
            value={reopenComment}
            onChange={e => setReopenComment(e.target.value)}
            required
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            placeholder="Reason for reopening..."
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowReopen(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">Reopen</button>
          </div>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Ticket Details">
        <form onSubmit={handleEditDetails} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={5}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Report Link <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="url"
              value={editReportLink}
              onChange={e => setEditReportLink(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="https://..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">Cancel</button>
            <button type="submit" disabled={actionLoading} className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50">Save changes</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
