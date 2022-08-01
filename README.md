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

## Scope

`postgres-bridge` is limited to the API that is consumed by [Slonik PostgreSQL client](https://www.npmjs.com/package/slonik), i.e. Using `postgres-bridge` you are able to use [`postgres`](https://www.npmjs.com/package/postgres) with Slonik.

Supported features:

* `pool.connect`
* `connection.query`

Please submit PR if you require additional compatibility.

## Development

Running `postgres-bridge` tests requires having a local PostgreSQL instance.

The easiest way to setup a temporary instance for testing is using Docker, e.g.

```bash
docker run --rm -it -e POSTGRES_HOST_AUTH_METHOD=trust -p 5432:5432 postgres
```
