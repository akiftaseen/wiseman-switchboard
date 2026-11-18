import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { statuses } from '../../shared/domain.js';
import { api } from '../api.js';

export default function CheckDialog({ service, onClose, onSave }) {
  const dialog = useRef(null);
  const [status, setStatus] = useState(service.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  function cancel(event) {
    event.preventDefault();
    if (!saving) onClose();
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const updated = await api(`services/${service.id}`, 'PATCH', { status });
      onSave(updated);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="check-title" onCancel={cancel}>
      <div className="panel-heading">
        <h2 id="check-title">Record a check</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={saving}
        >
          <X size={18} />
        </button>
      </div>
      <p>Choose the status you observed for <strong>{service.name}</strong>. Saving records the current time.</p>
      <form onSubmit={save}>
        <label htmlFor="service-status">Service status</label>
        <select
          id="service-status"
          value={status}
          onChange={event => setStatus(event.target.value)}
          disabled={saving}
        >
          {statuses.map(option => <option key={option}>{option}</option>)}
        </select>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="primary-button" disabled={saving}>
            <Check size={16} />
            {saving ? 'Saving…' : 'Save check'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
