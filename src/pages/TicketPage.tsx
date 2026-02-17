import { useParams } from 'react-router-dom';

export default function TicketPage() {
  const { id } = useParams();

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Ticket #{id}</h1>
      <p className="text-slate-600">Ticket details</p>
    </div>
  );
}
