import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { issueTypes, limits, requestErrors } from '../../shared/domain.js';
import { api } from '../api.js';
import { ticketId } from '../format.js';

const emptyForm = { name: '', issueType: '', description: '' };

export default function RequestForm({ onCreate, ready }) {
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm(previous => ({ ...previous, [name]: value }));
    setFieldErrors(previous => ({ ...previous, [name]: '' }));
    setNotice('');
  }

  function fieldProps(name) {
    return {
      id: name,
      name,
      required: true,
      value: form[name],
      disabled: submitting,
      onChange: updateField,
      'aria-invalid': Boolean(fieldErrors[name]),
      'aria-describedby': fieldErrors[name] ? `${name}-error` : undefined
    };
  }

  function fieldMessage(name) {
    if (fieldErrors[name]) {
      return <small className="error" id={`${name}-error`}>{fieldErrors[name]}</small>;
    }
  }

  async function submit(event) {
    event.preventDefault();
    const validationErrors = requestErrors(form);
    const firstInvalidField = Object.keys(validationErrors)[0];
    setFieldErrors(validationErrors);
    setNotice('');
    setSubmitError('');

    if (firstInvalidField) {
      event.currentTarget.elements.namedItem(firstInvalidField).focus();
      return;
    }

    setSubmitting(true);
    try {
      const created = await api('requests', 'POST', form);
      onCreate(created);
      setNotice(`${ticketId(created.id)} submitted.`);
      setForm(emptyForm);
    } catch (err) {
      setSubmitError(err.message);
      setFieldErrors(err.fields || {});
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel new-request" id="new-request" aria-labelledby="form-heading">
      <div className="panel-heading">
        <h2 id="form-heading">New request</h2>
        <Send size={19} className="muted-icon" />
      </div>
      <form noValidate onSubmit={submit}>
        <div>
          <label htmlFor="name">Employee name</label>
          <input {...fieldProps('name')} maxLength={limits.name} autoComplete="name" placeholder="Your name" />
          {fieldMessage('name')}
        </div>
        <div>
          <label htmlFor="issueType">Issue type</label>
          <select {...fieldProps('issueType')}>
            <option value="">Select an issue type</option>
            {issueTypes.map(issueType => <option key={issueType}>{issueType}</option>)}
          </select>
          {fieldMessage('issueType')}
        </div>
        <div>
          <label htmlFor="description">Description</label>
          <textarea
            {...fieldProps('description')}
            rows="3"
            maxLength={limits.description}
            placeholder="What happened, and how is it affecting your work?"
          />
          {fieldMessage('description')}
        </div>
        {submitError && <p role="alert" className="error">{submitError}</p>}
        {!ready && <p className="form-hint">Submission is available once the request queue loads.</p>}
        <button className="primary-button" disabled={submitting || !ready}>
          {submitting ? 'Submitting…' : 'Submit request'}
          <Send size={15} />
        </button>
        <div role="status" className="feedback">
          {notice && <><CheckCircle2 size={15} />{notice}</>}
        </div>
      </form>
    </section>
  );
}
