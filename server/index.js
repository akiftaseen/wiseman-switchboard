import { openDatabase } from './db.js';
import { createApp } from './app.js';

const db = openDatabase();
const port = Number(process.env.PORT || 3001);
const server = createApp(db).listen(port, '127.0.0.1', error => {
  if (error) {
    console.error('Could not start Switchboard:', error.message);
    db.close();
    process.exitCode = 1;
    return;
  }
  console.log(`Switchboard is ready at http://127.0.0.1:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => db.close()));
}
