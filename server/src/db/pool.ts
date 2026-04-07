import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

export { pool };

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV === 'development') {
    console.log('query:', { text, duration, rows: result.rowCount });
  }

  return result;
}

export async function withUser<T>(
  userId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    // Set the current user ID in session config for RLS using parameterized query
    await client.query('SELECT set_config($1, $2, true)', [
      'app.current_user_id',
      userId,
    ]);
    return await callback(client);
  } finally {
    client.release();
  }
}
