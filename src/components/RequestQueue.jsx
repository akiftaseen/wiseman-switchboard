import { useState } from 'react';
import { Check, Inbox, Ticket } from 'lucide-react';
import { formatTime, ticketId } from '../format.js';
import { api } from '../api.js';
import Badge from './Badge.jsx';

function RequestItem({ item, onResolve }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function resolve() {
    setBusy(true);
    setError('');
    try {
      onResolve(await api('requests/' + item.id, 'PATCH', { state: 'Resolved' }));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <li className="ticket">
    <div className="ticket-heading"><span className="ticket-id">{ticketId(item.id)}</span><Badge value={item.state}/></div>
    <h3>{item.issueType}</h3><p className="description">{item.description}</p>
    <div className="ticket-bottom"><span>{item.name} · <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time></span>
      {item.state === 'Open' && <button className="text-button" onClick={resolve} disabled={busy} aria-label={'Mark ' + ticketId(item.id) + ' resolved'}><Check size={14}/>{busy ? 'Saving…' : 'Mark resolved'}</button>}
    </div>{error && <p role="alert" className="error">{error}</p>}
  </li>;
}

export default function RequestQueue({ items, filter, setFilter, onResolve, children }) {
  const visible = items.filter(item => filter === 'All' || item.state === filter);
  return <section id="queue" className="panel queue" aria-labelledby="queue-heading">
    <div className="panel-heading"><h2 id="queue-heading">Request queue <span className="count">{items.length}</span></h2><Ticket size={20} className="muted-icon"/></div>
    <div className="filter" role="group" aria-label="Filter requests">{['All', 'Open', 'Resolved'].map(value =>
      <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>
    )}</div>
    {children || (visible.length ? <ul className="tickets">{visible.map(item => <RequestItem key={item.id} item={item} onResolve={onResolve}/>)}</ul> :
      <div className="empty"><span className="empty-icon"><Inbox size={28} strokeWidth={1.45}/></span><h3>{filter === 'All' ? 'No requests yet' : 'No ' + filter.toLowerCase() + ' requests'}</h3>
        <p>{filter === 'All' ? 'Submitted support requests will appear here.' : 'Choose another filter to see more requests.'}</p></div>)}
  </section>;
}
