import express from 'express';
import { fileURLToPath } from 'node:url';
import { requestErrors, statuses } from '../shared/domain.js';
import { prepareQueries } from './db.js';

export function createApp(db) {
  const app = express();
  const queries = prepareQueries(db);

  app.disable('x-powered-by');
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['POST', 'PATCH'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ error: 'Send a JSON object with Content-Type application/json.' });
    }
    next();
  });
  app.use('/api', express.json({ limit: '32kb', inflate: false }));

  app.get('/api/services', (req, res) => {
    res.json(queries.listServices.all());
  });

  app.patch('/api/services/:id', (req, res) => {
    const { status } = req.body ?? {};
    if (!statuses.includes(status)) {
      return res.status(400).json({ error: 'Choose Up, Degraded, or Down.' });
    }

    const service = queries.recordCheck.get(status, new Date().toISOString(), req.params.id);
    if (!service) return res.status(404).json({ error: 'Service not found.' });
    res.json(service);
  });

  app.get('/api/requests', (req, res) => {
    res.json(queries.listRequests.all());
  });

  app.post('/api/requests', (req, res) => {
    const input = req.body ?? {};
    const fields = requestErrors(input);
    if (Object.keys(fields).length) {
      return res.status(400).json({ error: 'Check the highlighted fields.', fields });
    }

    const request = queries.createRequest.get(
      input.name.trim(),
      input.issueType,
      input.description.trim(),
      new Date().toISOString()
    );
    res.status(201).json(request);
  });

  app.patch('/api/requests/:id', (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) {
      return res.status(400).json({ error: 'Use a positive integer request ID.' });
    }
    if (req.body?.state !== 'Resolved') return res.status(400).json({ error: 'Choose Resolved to close a request.' });

    const request = queries.resolveRequest.get(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    res.json(request);
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  app.use(express.static(fileURLToPath(new URL('../dist/', import.meta.url))));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The JSON body is invalid.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The request body is too large.' });
    if (err.status === 415) return res.status(415).json({ error: 'Unsupported request encoding.' });
    console.error(err);
    res.status(500).json({ error: 'The server could not complete the request. Please try again.' });
  });
  return app;
}
