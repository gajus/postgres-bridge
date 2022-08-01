import {
  EventEmitter,
} from 'node:events';
import genericPool from 'generic-pool';
import type Postgres from 'postgres';
import {
  type Sql,
} from 'postgres';

type PgPool = {
  database?: string,
  host?: string,
  idleTimeoutMillis?: number,
  max?: number,
  min?: number,
  password?: string,
  port?: number,
  ssl?: boolean,
  user?: string,
};

type AnySql = Sql<{}>;

type Command = 'DELETE' | 'INSERT' | 'SELECT' | 'UPDATE';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

type QueryResult = {
  command: Command,
  fields: Array<{
    dataTypeID: number,
    name: string,
  }>,
  rowCount: number,
  rows: Row[],
};

export const bridge = (postgres: typeof Postgres, poolConfiguration: PgPool) => {
  const events = new EventEmitter();

  const pool = genericPool.createPool<AnySql>({
    create: async () => {
      return postgres({
        database: poolConfiguration.database,
        host: poolConfiguration.host ?? 'localhost',
        idle_timeout: poolConfiguration.idleTimeoutMillis ? poolConfiguration.idleTimeoutMillis / 1_000 : 0,
        max: 1,
        password: poolConfiguration.password,
        port: poolConfiguration.port ?? 5_432,
        ssl: poolConfiguration.ssl,
        username: poolConfiguration.user,
      });
    },
    destroy: (client: Sql<{}>) => {
      return client.end({
        timeout: 5,
      });
    },
  }, {
    max: poolConfiguration.max,
    min: poolConfiguration.min,
  });

  return {
    connect: async () => {
      const connection = await pool.acquire();

      const compatibleConnection = {
        query: async (sql: string): Promise<QueryResult> => {
          // https://github.com/porsager/postgres#result-array
          const resultArray = await connection.unsafe(sql);

          return {
            command: resultArray.command as Command,
            fields: resultArray.columns.map((column) => {
              return {
                dataTypeID: column.type,
                name: column.name,
              };
            }),
            rowCount: resultArray.count,
            rows: Array.from(resultArray),
          };
        },
      };

      events.emit('connect', compatibleConnection);

      return compatibleConnection;
    },
    off: events.off.bind(events),
    on: events.on.bind(events),
  };
};
