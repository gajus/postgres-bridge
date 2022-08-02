import test from 'ava';
import {
  Pool as PgPool,
// @ts-expect-error-next-line pg types not available
} from 'pg';
import postgres from 'postgres';
import * as sinon from 'sinon';
import {
  createPostgresBridge,
} from '../../src/bridge';

const PostgresBridge = createPostgresBridge(postgres);

const clients = [
  {
    name: 'pg',
    Pool: PgPool,
  },
  {
    name: 'postgres-bridge',
    Pool: PostgresBridge,
  },
];

for (const {
  name: clientName,
  Pool,
} of clients) {
  test(clientName + ': "connect" event is fired when a new connection is made', async (t) => {
    const pool = new Pool({
      user: 'postgres',
    });

    const spy = sinon.spy();

    pool.on('connect', spy);

    const connection = await pool.connect();

    t.true(spy.called);

    t.is(spy.firstCall.args[0], connection);
  });

  test(clientName + ': "remove" event is fired when connection is removed', async (t) => {
    const pool = new Pool({
      user: 'postgres',
    });

    const spy = sinon.spy();

    pool.on('remove', spy);

    const connection = await pool.connect();

    await pool._remove(connection);

    t.true(spy.called);

    t.is(spy.firstCall.args[0], connection);

    t.is(pool.totalCount, 0);
  });

  test(clientName + ': "notice event is fired when connection produces a notice"', async (t) => {
    const pool = new Pool({
      user: 'postgres',
    });

    const connection = await pool.connect();

    const spy = sinon.spy();

    connection.on('notice', spy);

    await connection.query(`
    CREATE OR REPLACE PROCEDURE raise_notice () AS $$
    DECLARE
      a INT:= 10;
    BEGIN
      RAISE NOTICE 'value of a: %', a;
    END;
    $$
    LANGUAGE plpgsql;
    `);

    await connection.query(`
      CALL raise_notice();
    `);

    t.true(spy.called);

    t.like(spy.firstCall.args[0], {
      code: '00000',
      file: 'pl_exec.c',
      line: '3859',
      message: 'value of a: 10',
      routine: 'exec_stmt_raise',
      severity: 'NOTICE',
      where: 'PL/pgSQL function raise_notice() line 5 at RAISE',
    });
  });

  test(clientName + ': pool.connect() 2x creates two connections', async (t) => {
    const pool = new Pool({
      user: 'postgres',
    });

    t.is(pool.totalCount, 0);

    const connection1 = await pool.connect();
    const connection2 = await pool.connect();

    t.is(pool.totalCount, 2);

    await connection1.end();
    await connection2.end();
  });

  test(clientName + ': pool.end() destroys all connections', async (t) => {
    const pool = new Pool({
      user: 'postgres',
    });

    t.is(pool.totalCount, 0);

    const connection1 = await pool.connect();
    const connection2 = await pool.connect();

    t.is(pool.totalCount, 2);

    await connection1.release();
    await connection2.release();

    await pool.end();

    t.is(pool.totalCount, 0);
  });

  test(clientName + ': connection.release() releases connection back to the pool', async (t) => {
    const pool = new Pool({
      user: 'postgres',
    });

    const connection = await pool.connect();

    t.is(pool.idleCount, 0);

    await connection.release();

    t.is(pool.idleCount, 1);
  });

  test(clientName + ': connection.query() returns expected results', async (t) => {
    const pool = new Pool({
      user: 'postgres',
    });

    const connection = await pool.connect();

    const result = await connection.query('SELECT 1');

    t.is(result.rows.length, 1);
    t.is(result.command, 'SELECT');
    t.like(result.rows[0],
      {
        '?column?': 1,
      });
    t.like(result.fields[0],
      {
        dataTypeID: 23,
        name: '?column?',
      });
  });

  test(clientName + ': connection.query() interpolates parameters', async (t) => {
    const pool = new Pool({
      user: 'postgres',
    });

    const connection = await pool.connect();

    const result = await connection.query('SELECT $1', [
      'foo',
    ]);

    t.like(result.rows[0],
      {
        '?column?': 'foo',
      });
  });

  test(clientName + ': _clients returns all active connections', async (t) => {
    const pool = new Pool({
      user: 'postgres',
    });

    const connection = await pool.connect();

    t.is(pool._clients[0], connection);
  });
}
