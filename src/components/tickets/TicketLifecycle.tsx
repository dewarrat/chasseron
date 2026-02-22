import { CheckCircle, Circle } from 'lucide-react';

interface TicketLifecycleProps {
  status: string;
  duplicateOf: number | null;
}

const steps = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'testing', label: 'Testing' },
  { key: 'resolved', label: 'Resolved' },
];

const terminalStates: Record<string, string> = {
  cancelled: 'Cancelled',
  duplicate: 'Duplicate',
  blocked: 'Blocked',
};

export default function TicketLifecycle({ status, duplicateOf }: TicketLifecycleProps) {
  const isTerminal = status in terminalStates;
  const currentIndex = steps.findIndex(s => s.key === status);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Lifecycle</h3>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isActive = step.key === status;
          const isPast = currentIndex >= 0 ? idx < currentIndex : false;
          const isDone = isPast || (isActive && step.key === 'resolved');

          return (
            <div key={step.key} className="flex items-center gap-2.5">
              {isDone ? (
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              ) : isActive ? (
                <div className="w-4 h-4 rounded-full border-2 border-teal-500 bg-teal-500 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />
              )}
              <span className={`text-sm ${isActive ? 'font-medium text-slate-900' : isDone ? 'text-slate-500' : 'text-slate-400'}`}>
                {step.label}
              </span>
            </div>
          );
        })}

        {isTerminal && (
          <div className="flex items-center gap-2.5 pt-1 border-t border-slate-100">
            <div className="w-4 h-4 rounded-full border-2 border-red-400 bg-red-400 flex-shrink-0" />
            <span className="text-sm font-medium text-red-600">
              {terminalStates[status]}
              {status === 'duplicate' && duplicateOf ? ` of #${duplicateOf}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
