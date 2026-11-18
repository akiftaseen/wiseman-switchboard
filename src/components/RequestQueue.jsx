import { useRef, useState } from 'react';
import { Check, Inbox, RotateCcw, Ticket } from 'lucide-react';
import { OPEN, requestStates, RESOLVED } from '../../shared/domain.js';
import { api } from '../api.js';
import { formatTime, ticketId } from '../format.js';
import Badge from './Badge.jsx';

const filters = ['All', ...requestStates];

function RequestItem({ item, onStateChange }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const label = ticketId(item.id);

  const isOpen = item.state === OPEN;
  const nextState = isOpen ? RESOLVED : OPEN;
  const ActionIcon = isOpen ? Check : RotateCcw;
  const action = isOpen ? 'Mark resolved' : 'Reopen';

  async function updateState(event) {
    if (saving) return;
    const button = event.currentTarget;
    setSaving(true);
    setError('');

    try {
      const updated = await api(`requests/${item.id}`, 'PATCH', { state: nextState });
      onStateChange(updated, document.activeElement === button);
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
        <button
          type="button"
          className="text-button"
          onClick={updateState}
          aria-disabled={saving}
          aria-label={isOpen ? `Mark ${label} resolved` : `Reopen ${label}`}
        >
          <ActionIcon size={14} aria-hidden="true" />
          {saving ? 'Saving…' : action}
        </button>
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

export default function RequestQueue({ items, filter, onFilterChange, onStateChange, loadMessage }) {
  const visibleItems = items.filter(item => filter === 'All' || item.state === filter);
  const activeFilter = useRef(null);
  const [notice, setNotice] = useState('');
  let content = loadMessage;

  function reportStateChange(updated, restoreFocus) {
    if (filter !== 'All' && filter !== updated.state && restoreFocus) {
      activeFilter.current?.focus();
    }
    onStateChange(updated);
    const action = updated.state === RESOLVED ? 'marked resolved' : 'reopened';
    setNotice(`${ticketId(updated.id)} ${action}.`);
  }

  if (!content && visibleItems.length) {
    content = (
      <ul className="tickets">
        {visibleItems.map(item => <RequestItem key={item.id} item={item} onStateChange={reportStateChange} />)}
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
            ref={filter === value ? activeFilter : null}
            onClick={() => onFilterChange(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {content || <EmptyQueue filter={filter} />}
      <div role="status" className="feedback">{notice}</div>
    </section>
  );
}
