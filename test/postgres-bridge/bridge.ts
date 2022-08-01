import test from 'ava';
import postgres from 'postgres';
import {
  bridge,
} from '../../src/bridge';

test('query method', async (t) => {
  const pool = bridge(postgres, {
    user: 'postgres',
  });

  const connection = await pool.connect();

  const result = await connection.query('SELECT 1');

  t.is(result.rows.length, 1);
  t.is(result.command, 'SELECT');
  t.deepEqual(result.rows, [
    {
      '?column?': 1,
    },
  ]);
  t.deepEqual(result.fields, [
    {
      dataTypeID: 23,
      name: '?column?',
    },
  ]);
});
