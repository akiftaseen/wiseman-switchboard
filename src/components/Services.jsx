import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowUpRight, Check, CircleAlert, Clock3, FolderClosed, Mail, ShieldCheck, X } from 'lucide-react';
import { statuses } from '../../shared/domain.js';
import { formatTime } from '../format.js';
import Badge from './Badge.jsx';
import { api } from '../api.js';

const servicesUI = {
  email: { icon: Mail, description: 'Mailboxes and calendars' },
  vpn: { icon: ShieldCheck, description: 'Secure remote access' },
  'file-share': { icon: FolderClosed, description: 'Shared folders and documents' }
};

function CheckDialog({ service, onClose, onSave }) {
  const dialog = useRef(null);
  const [status, setStatus] = useState(service.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      onSave(await api('services/' + service.id, 'PATCH', { status }));
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }
  return <dialog ref={dialog} aria-labelledby="check-title" onCancel={event => {
    event.preventDefault();
    if (!saving) onClose();
  }}>
    <div className="panel-heading"><h2 id="check-title">Record a check</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={saving}><X size={18}/></button></div>
    <p>Choose the status you observed for <strong>{service.name}</strong>. Saving records the current time.</p>
    <form onSubmit={save}>
      <label htmlFor="service-status">Service status</label>
      <select id="service-status" value={status} onChange={e => setStatus(e.target.value)} disabled={saving}>{statuses.map(s => <option key={s}>{s}</option>)}</select>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button className="primary-button" disabled={saving}><Check size={16}/>{saving ? 'Saving…' : 'Save check'}</button></div>
    </form>
  </dialog>;
}

export default function Services({ services, setServices }) {
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const counts = Object.fromEntries(statuses.map(s => [s, services.filter(item => item.status === s).length]));
  const affected = services.filter(item => item.status !== 'Operational');
  const heading = counts.Down === services.length ? 'Service outage' : affected.length ? 'Partial disruption' : 'All services operational';
  const summary = affected.length ? affected.map(s => s.name + ' is marked ' + s.status.toLowerCase()).join('. ') + '.' : 'All three services are marked operational.';
  return <section aria-label="Service status">
    <div className="status-board">
      <div className="board-copy">
        <div className="board-label"><Activity size={16} aria-hidden="true"/> SERVICE OVERVIEW</div>
        <h2>{heading}</h2><p>{summary}</p>
      </div>
      <dl className="totals">{statuses.map(status => <div key={status}>
        <dt><i className={'dot ' + status.toLowerCase()}/>{status}</dt>
        <dd>{String(counts[status]).padStart(2, '0')}</dd>
      </div>)}</dl>
    </div>
    <div className="service-grid">{services.map(service => {
      const { icon: Icon, description } = servicesUI[service.id];
      return <article className="service-card" key={service.id}>
        <div className="service-top"><span className={'service-icon ' + service.id}><Icon size={22} strokeWidth={1.7}/></span><Badge value={service.status}/></div>
        <h3>{service.name}</h3><p>{description}</p>
        <div className="card-bottom">
          <div className="checked"><span><Clock3 size={12}/> Last checked</span><time dateTime={service.checkedAt}>{formatTime(service.checkedAt)}</time></div>
          <button className="text-button" aria-label={'Record check for ' + service.name} onClick={() => { setNotice(''); setEditing(service); }}>Record check <ArrowUpRight size={14}/></button>
        </div>
      </article>;
    })}</div>
    <div className="sample-note"><CircleAlert size={14}/> Manually maintained sample data. Times reflect recorded checks.</div>
    <div role="status" className="feedback">{notice}</div>
    {editing && <CheckDialog service={editing} onClose={() => setEditing(null)} onSave={updated => {
      setServices(items => items.map(item => item.id === updated.id ? updated : item));
      setNotice(updated.name + ' check saved.');
      setEditing(null);
    }}/>}
  </section>;
}
