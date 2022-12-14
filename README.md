# `postgres`/`pg` compatibility layer

[![Canonical Code Style](https://img.shields.io/badge/code%20style-canonical-blue.svg?style=flat-square)](https://github.com/gajus/canonical)
[![Twitter Follow](https://img.shields.io/twitter/follow/kuizinas.svg?style=social&label=Follow)](https://twitter.com/kuizinas)

Wraps [`postgres`](https://www.npmjs.com/package/postgres) API in a [`pg`](https://www.npmjs.com/package/pg) compatible API.

## Usage

```ts
import postgres from 'postgres';
import { createPostgresBridge } from 'postgres-bridge';

const PostgresBridge = createPostgresBridge(postgres);

// pg.Pool Configuration
const configuration = {
  host: 'localhost',
  user: 'database-user',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = new PostgresBridge(configuration);

const connection = await pool.connect();

await pg.query('SELECT $1::text as name', ['foo']);
```

## Motivation

`postgres` is leaner/[faster](https://github.com/porsager/postgres-benchmarks) implementation of PostgreSQL protocol in Node.js than `pg`. However, `postgres` API is very different from the more broadly adopted [`pg` client](https://www.npmjs.com/package/pg).

This package allows to adopt `postgres` without going through a painful migration. In particular, this compatibility layer has been designed to allow adoption of `postgres` using [Slonik PostgreSQL client](https://www.npmjs.com/package/slonik).

## Compatibility

`postgres-bridge` was primarily developed to enable `postgres` use with [Slonik PostgreSQL client](https://www.npmjs.com/package/slonik). However, the scope has since been expanded to support several projects. It is now used in production by a handful real-world applications.

Known incompatibilities:

* Implicit query pooling is not implemented, i.e. You must use `pool.connect()`
* `connection.processID` not implemented
* `pool._pulseQueue` not implemented
* [callback (CPS) interface](https://github.com/brianc/node-postgres/tree/master/packages/pg-pool#drop-in-backwards-compatible) is not implemented (use promises instead)
* [providing configuration using environment variables](https://github.com/brianc/node-postgres/tree/master/packages/pg-pool#environment-variables) is not implemented
* [bring your own promise](https://github.com/brianc/node-postgres/tree/master/packages/pg-pool#bring-your-own-promise) is not implemented

Please submit PR if you require additional compatibility.

## Benchmark

A basic [benchmark](./test/postgres-bridge/benchmark.ts) shows no overhead as a result of using `postgres-bridge`:

```
pg query: 880ms
postgres query: 867ms
postgres-bridge query: 871ms
```

While these benchmarks do not show meaningful difference between `pg` and `postgres`, in production, in a large codebase, we noticed average response time improve by 30%. It means that in real-world scenarios, `postgres` overhead is significantly lesser than that of `pg`.

## Development

Running `postgres-bridge` tests requires having a local PostgreSQL instance.

The easiest way to setup a temporary instance for testing is using Docker, e.g.

```bash
docker run --rm -it -e POSTGRES_HOST_AUTH_METHOD=trust -p 5432:5432 postgres
```
