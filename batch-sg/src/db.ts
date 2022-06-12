import { Pool } from 'pg';

// PostgreSQL
export const pg = new Pool({
  user: 'steampipe',
  host:
    process.env.NODE_ENV === 'production' ? process.env.SP_HOST : 'localhost',
  database: 'steampipe',
  password:
    process.env.NODE_ENV === 'production'
      ? process.env.SP_PASSWORD
      : 'fb50_4f86_ba12',
  port: 9193,
});

pg.connect((err) => {
  if (err) {
    console.error('[PostgreSQL] DB Error', err);
  } else {
    console.log('[PostgreSQL] 🚀 Connected to DB');
  }
});
