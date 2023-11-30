// This is not really a test, but just a sanity check to ensure
// that our wrapper does not add substantial overhead to `postgres` implementation.

import {
  createPostgresBridge,
} from '../../src/bridge';
import test from 'ava';
import {
  Pool as PgPool,
// @ts-expect-error-next-line pg types not available
} from 'pg';
import postgres from 'postgres';

const PostgresBridge = createPostgresBridge(postgres);

test.serial('pg: benchmark connection.query()', async (t) => {
  const pool = new PgPool({
    user: 'postgres',
  });

  const connection = await pool.connect();

  // warm up
  await connection.query('SELECT 1');

  console.time('pg query');

  let index = 1_000;

  while (index-- > 0) {
    await connection.query('SELECT 1');
  }

  console.timeEnd('pg query');

  t.true(true);
});

test.serial('postgres: benchmark connection.query()', async (t) => {
  const sql = postgres({
    max: 1,
    user: 'postgres',
  });

  // warm up
  await sql`SELECT 1`;

  console.time('postgres query');

  let index = 1_000;

  while (index-- > 0) {
    await sql`SELECT 1`;
  }

  console.timeEnd('postgres query');

  t.true(true);
});

test.serial('postgres-bridge: benchmark connection.query()', async (t) => {
  const pool = new PostgresBridge({
    user: 'postgres',
  });

  const connection = await pool.connect();

  // warm up
  await connection.query('SELECT 1');

  console.time('postgres-bridge query');

  let index = 1_000;

  while (index-- > 0) {
    await connection.query('SELECT 1');
  }

  console.timeEnd('postgres-bridge query');

  t.true(true);
});

