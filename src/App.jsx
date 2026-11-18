import { useEffect, useState } from 'react';
import { CalendarDays, PanelsTopLeft } from 'lucide-react';
import { api } from './api.js';
import { ticketId } from './format.js';
import Services from './components/Services.jsx';
import RequestForm from './components/RequestForm.jsx';
import RequestQueue from './components/RequestQueue.jsx';

const dateLabel = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

function useCollection(path) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadItems() {
      try {
        const records = await api(path);
        if (active) setItems(records);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadItems();
    return () => { active = false; };
  }, [path, attempt]);

  function retry() {
    setLoading(true);
    setError('');
    setAttempt(previous => previous + 1);
  }

  return { items, setItems, loading, error, retry, ready: !loading && !error };
}

function LoadState({ collection }) {
  if (collection.loading) {
    return <p className="load-state" role="status">Loading records…</p>;
  }

  return (
    <div className="load-state" role="alert">
      {collection.error}{' '}
      <button className="text-button" onClick={collection.retry}>Retry</button>
    </div>
  );
}

export default function App() {
  const services = useCollection('services');
  const requests = useCollection('requests');
  const [filter, setFilter] = useState('All');
  const [notice, setNotice] = useState('');

  function updateService(updated) {
    services.setItems(items => items.map(item => item.id === updated.id ? updated : item));
  }

  function addRequest(created) {
    requests.setItems(items => [created, ...items]);
    setFilter('All');
    setNotice('');
  }

  function resolveRequest(updated) {
    requests.setItems(items => items.map(item => item.id === updated.id ? updated : item));
    setNotice(ticketId(updated.id) + ' marked resolved.');
  }

  return (
    <>
      <a className="skip" href="#main">Skip to dashboard</a>
      <header className="masthead">
        <div className="shell mast-inner">
          <a className="brand" href="#main">
            <img src="/switchboard.svg" width="33" height="33" alt="" />
            Switchboard
          </a>
          <span className="mast-divider" />
          <span className="workspace">IT workspace</span>
          <nav aria-label="Dashboard shortcuts">
            <a href="#queue">Request queue</a>
            <a className="new-link" href="#new-request">
              New request <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
      </header>
      <main className="shell" id="main">
        <div className="page-heading">
          <div>
            <div className="breadcrumb">
              <PanelsTopLeft size={14} /> Workspace <span>/</span> Overview
            </div>
            <h1>Service desk</h1>
          </div>
          <div className="today">
            <CalendarDays size={15} />
            {dateLabel.format(new Date())}
          </div>
        </div>
        {services.ready ? (
          <Services services={services.items} onUpdate={updateService} />
        ) : (
          <LoadState collection={services} />
        )}
        <div className="support-grid">
          <RequestQueue
            items={requests.items}
            filter={filter}
            onFilterChange={setFilter}
            onResolve={resolveRequest}
          >
            {!requests.ready && <LoadState collection={requests} />}
          </RequestQueue>
          <RequestForm ready={requests.ready} onCreate={addRequest} />
        </div>
        <div role="status" className="feedback">{notice}</div>
      </main>
    </>
  );
}
