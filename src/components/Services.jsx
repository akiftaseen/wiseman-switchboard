import { useState } from 'react';
import { ArrowUpRight, CircleAlert, Clock3, FolderClosed, Mail, ShieldCheck } from 'lucide-react';
import { statuses } from '../../shared/domain.js';
import { formatTime } from '../format.js';
import Badge from './Badge.jsx';
import CheckDialog from './CheckDialog.jsx';

const serviceDetails = {
  email: { icon: Mail, description: 'Mailboxes and calendars' },
  vpn: { icon: ShieldCheck, description: 'Secure remote access' },
  'file-share': { icon: FolderClosed, description: 'Shared folders and documents' }
};

function ServiceCard({ service, onRecordCheck }) {
  const { icon: Icon, description } = serviceDetails[service.id];

  return (
    <article className="service-card">
      <div className="service-top">
        <span className="service-icon">
          <Icon size={22} strokeWidth={1.7} />
        </span>
        <Badge value={service.status} />
      </div>
      <h2>{service.name}</h2>
      <p>{description}</p>
      <div className="card-bottom">
        <div className="checked">
          <span><Clock3 size={12} /> Last checked</span>
          <time dateTime={service.checkedAt}>{formatTime(service.checkedAt)}</time>
        </div>
        <button className="text-button" aria-label={`Record check for ${service.name}`} onClick={onRecordCheck}>
          Record check <ArrowUpRight size={14} />
        </button>
      </div>
    </article>
  );
}

export default function Services({ services, onUpdate }) {
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const counts = Object.fromEntries(statuses.map(status => [status, 0]));

  for (const service of services) counts[service.status]++;

  const affected = services.filter(service => service.status !== 'Operational');
  let heading = 'All services operational';
  if (counts.Down === services.length) heading = 'Service outage';
  else if (affected.length) heading = 'Partial disruption';

  const summary = affected.map(service => `${service.name} is marked ${service.status.toLowerCase()}.`).join(' ');

  function openCheckDialog(service) {
    setNotice('');
    setEditing(service);
  }

  function saveCheck(updated) {
    onUpdate(updated);
    setNotice(`${updated.name} check saved.`);
    setEditing(null);
  }

  return (
    <section aria-label="Service status">
      <div className="status-board">
        <div className="board-copy">
          <h1>Service overview</h1>
          <p>{heading}.{summary && ` ${summary}`}</p>
        </div>
        <dl className="totals">
          {statuses.map(status => (
            <div key={status} className={status.toLowerCase()}>
              <dt>{status}</dt>
              <dd>{counts[status]}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="service-grid">
        {services.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            onRecordCheck={() => openCheckDialog(service)}
          />
        ))}
      </div>
      <div className="sample-note">
        <CircleAlert size={14} /> Manually maintained sample data. Times reflect recorded checks.
      </div>
      <div role="status" className="feedback">{notice}</div>
      {editing && (
        <CheckDialog service={editing} onClose={() => setEditing(null)} onSave={saveCheck} />
      )}
    </section>
  );
}
