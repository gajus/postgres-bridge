# `postgres`/`pg` compatibility layer

[![Canonical Code Style](https://img.shields.io/badge/code%20style-canonical-blue.svg?style=flat-square)](https://github.com/gajus/canonical)
[![Twitter Follow](https://img.shields.io/twitter/follow/kuizinas.svg?style=social&label=Follow)](https://twitter.com/kuizinas)

Wraps [`postgres`](https://www.npmjs.com/package/postgres) API in a [`pg`](https://www.npmjs.com/package/pg) compatible API.

## Usage

```ts
import postgres from 'postgres';
import { bridge } from 'postgres-bridge';

// pg.Pool Configuration
const configuration = {
  host: 'localhost',
  user: 'database-user',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

const pool = bridge(postgres, configuration);

const connection = await pool.connect();

await pg.query('SELECT $1::text as name', ['foo']);
```

## Motivation

`postgres` is leaner/faster implementation of PostgreSQL protocol in Node.js than `pg`. However, `postgres` API is very different from the more broadly adopted [`pg` client](https://www.npmjs.com/package/pg). This package allows to adopt `postgres` without going through a painful migration. In particular, this compatibility layer has been designed to allow adoption of `postgres` using [Slonik PostgreSQL client](https://www.npmjs.com/package/slonik).

## Scope

`postgres-bridge` is limited to the API that is consumed by [Slonik PostgreSQL client](https://www.npmjs.com/package/slonik), i.e. Using `postgres-bridge` you are able to use [`postgres`](https://www.npmjs.com/package/postgres) with Slonik.

Supported features:

* `pool.connect`
* `connection.query`
* `connect` event
* `notice` event

Please submit PR if you require additional compatibility.

## Development

Running `postgres-bridge` tests requires having a local PostgreSQL instance.

The easiest way to setup a temporary instance for testing is using Docker, e.g.

```bash
docker run --rm -it -e POSTGRES_HOST_AUTH_METHOD=trust -p 5432:5432 postgres
```