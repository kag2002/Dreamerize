import { app } from './app';
import { PORT } from './config';
import { runMigrations } from './db/migrations';
import { seedDatabase } from './db/seed';
import { getDatabase } from './db/connection';

try {
  const db = getDatabase();
  runMigrations(db);

  const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  seedDatabase(db);
  if (userCount.count === 0) {
    console.log('Database seeded with default accounts and spaces.');
  }
} catch (err) {
  console.error('Failed to initialize database:', err);
}

app.listen(PORT, () => {
  console.log(`Dreamerize server running on http://localhost:${PORT}`);
});
