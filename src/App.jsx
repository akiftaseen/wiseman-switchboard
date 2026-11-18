import { useEffect, useState } from 'react';
import { CalendarDays, PanelsTopLeft } from 'lucide-react';
import Services from './components/Services.jsx';
import RequestQueue from './components/RequestQueue.jsx';
import RequestForm from './components/RequestForm.jsx';
import { ticketId } from './format.js';
import { api } from './api.js';

function useCollection(path) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api(path).then(data => {
      if (active) { setItems(data); setState('ready'); }
    }).catch(error => { if (active) setState(error.message); });
    return () => { active = false; };
  }, [path, attempt]);
  function retry() { setState('loading'); setAttempt(n => n + 1); }
  return { items, setItems, state, retry };
}

function LoadState({ collection }) {
  if (collection.state === 'loading') return <p className="load-state" role="status">Loading records…</p>;
  return <div className="load-state" role="alert">{collection.state} <button className="text-button" onClick={collection.retry}>Retry</button></div>;
}

export default function App() {
  const services = useCollection('services');
  const requests = useCollection('requests');
  const [filter, setFilter] = useState('All');
  const [notice, setNotice] = useState('');
  return <>
    <a className="skip" href="#main">Skip to dashboard</a>
    <header className="masthead"><div className="shell mast-inner">
      <a className="brand" href="#main"><img src="/switchboard.svg" width="33" height="33" alt=""/>Switchboard</a>
      <span className="mast-divider"/><span className="workspace">IT workspace</span>
      <nav aria-label="Dashboard shortcuts"><a href="#queue">Request queue</a><a className="new-link" href="#new-request">New request <span aria-hidden="true">↗</span></a></nav>
    </div></header>
    <main className="shell" id="main">
      <div className="page-heading"><div><div className="breadcrumb"><PanelsTopLeft size={14}/> Workspace <span>/</span> Overview</div><h1>Service desk</h1></div>
        <div className="today"><CalendarDays size={15}/>{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}</div>
      </div>
      {services.state === 'ready' ? <Services services={services.items} setServices={services.setItems}/> : <LoadState collection={services}/>}
      <div className="support-grid">
        <RequestQueue items={requests.items} filter={filter} setFilter={setFilter} onResolve={updated => {
          requests.setItems(items => items.map(item => item.id === updated.id ? updated : item));
          setNotice(ticketId(updated.id) + ' marked resolved.');
        }}>{requests.state !== 'ready' && <LoadState collection={requests}/>}</RequestQueue>
        <RequestForm ready={requests.state === 'ready'} onCreate={created => {
          requests.setItems(items => [created, ...items]); setFilter('All'); setNotice('');
        }}/>
      </div>
      <div role="status" className="feedback">{notice}</div>
    </main>
  </>;
}
