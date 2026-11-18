import { useState } from 'react';
import { Check, Inbox, Ticket } from 'lucide-react';
import { api } from '../api.js';
import { formatTime, ticketId } from '../format.js';
import Badge from './Badge.jsx';

const filters = ['All', 'Open', 'Resolved'];

function RequestItem({ item, onResolve }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const label = ticketId(item.id);

  async function resolveRequest() {
    setSaving(true);
    setError('');

    try {
      const updated = await api(`requests/${item.id}`, 'PATCH', { state: 'Resolved' });
      onResolve(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="ticket">
      <div className="ticket-heading">
        <span className="ticket-id">{label}</span>
        <Badge value={item.state} />
      </div>
      <h3>{item.issueType}</h3>
      <p className="description">{item.description}</p>
      <div className="ticket-bottom">
        <span>{item.name} · <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time></span>
        {item.state === 'Open' && (
          <button
            className="text-button"
            onClick={resolveRequest}
            disabled={saving}
            aria-label={`Mark ${label} resolved`}
          >
            <Check size={14} />
            {saving ? 'Saving…' : 'Mark resolved'}
          </button>
        )}
      </div>
      {error && <p role="alert" className="error">{error}</p>}
    </li>
  );
}

function EmptyQueue({ filter }) {
  const showingAll = filter === 'All';
  return (
    <div className="empty">
      <span className="empty-icon"><Inbox size={28} strokeWidth={1.45} /></span>
      <h3>{showingAll ? 'No requests yet' : `No ${filter.toLowerCase()} requests`}</h3>
      <p>{showingAll ? 'Submitted support requests will appear here.' : 'Choose another filter to see more requests.'}</p>
    </div>
  );
}

export default function RequestQueue({ items, filter, notice, onFilterChange, onResolve, children }) {
  const visibleItems = items.filter(item => filter === 'All' || item.state === filter);
  let content = children;

  if (!content && visibleItems.length) {
    content = (
      <ul className="tickets">
        {visibleItems.map(item => <RequestItem key={item.id} item={item} onResolve={onResolve} />)}
      </ul>
    );
  }

  return (
    <section id="queue" className="panel queue" aria-labelledby="queue-heading">
      <div className="panel-heading">
        <h2 id="queue-heading">Request queue <span className="count">{items.length}</span></h2>
        <Ticket size={20} className="muted-icon" />
      </div>
      <div className="filter" role="group" aria-label="Filter requests">
        {filters.map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <div role="status" className="feedback queue-notice">
        {notice ? <><Check size={15} />{notice}</> : null}
      </div>
      {content || <EmptyQueue filter={filter} />}
    </section>
  );
}
