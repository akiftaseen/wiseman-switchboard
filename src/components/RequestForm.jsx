import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { issueTypes, limits, requestErrors } from '../../shared/domain.js';
import { api } from '../api.js';
import { ticketId } from '../format.js';

const blank = { name: '', issueType: '', description: '' };

export default function RequestForm({ onCreate, ready }) {
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  function field(name) {
    return {
      id: name, name, required: true, value: form[name], disabled: busy,
      'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? name + '-error' : undefined,
      onChange: e => {
        setForm({ ...form, [name]: e.target.value });
        setErrors({ ...errors, [name]: '' });
        setNotice('');
      }
    };
  }
  const message = name => errors[name] && <small className="error" id={name + '-error'}>{errors[name]}</small>;
  async function submit(event) {
    event.preventDefault();
    const invalid = requestErrors(form);
    setErrors(invalid);
    setNotice('');
    setError('');
    if (Object.keys(invalid).length) {
      event.currentTarget.elements[Object.keys(invalid)[0]].focus();
      return;
    }
    setBusy(true);
    try {
      const created = await api('requests', 'POST', form);
      onCreate(created);
      setNotice(ticketId(created.id) + ' submitted.');
      setForm(blank);
    } catch (err) {
      setError(err.message);
      setErrors(err.fields || {});
    } finally { setBusy(false); }
  }
  return <section className="panel new-request" id="new-request" aria-labelledby="form-heading">
    <div className="panel-heading"><h2 id="form-heading">New request</h2><Send size={19} className="muted-icon"/></div>
    <form noValidate onSubmit={submit}>
      <div><label htmlFor="name">Employee name</label><input {...field('name')} maxLength={limits.name} autoComplete="name" placeholder="Your name"/>{message('name')}</div>
      <div><label htmlFor="issueType">Issue type</label><select {...field('issueType')}><option value="">Select an issue type</option>{issueTypes.map(type => <option key={type}>{type}</option>)}</select>{message('issueType')}</div>
      <div><label htmlFor="description">Description</label><textarea {...field('description')} rows="3" maxLength={limits.description} placeholder="What happened, and how is it affecting your work?"/>{message('description')}</div>
      {error && <p role="alert" className="error">{error}</p>}
      {!ready && <p className="form-hint">Submission is available once the request queue loads.</p>}
      <button className="primary-button submit" disabled={busy || !ready}>{busy ? 'Submitting…' : 'Submit request'}<Send size={15}/></button>
      <div role="status" className="feedback">{notice && <><CheckCircle2 size={15}/>{notice}</>}</div>
    </form>
  </section>;
}
