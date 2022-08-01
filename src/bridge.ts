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
  const poolEvents = new EventEmitter();

  const pool = genericPool.createPool<AnySql & {events: EventEmitter, }>({
    create: async () => {
      const connectionEvents = new EventEmitter();

      const connection = postgres({
        database: poolConfiguration.database,
        host: poolConfiguration.host ?? 'localhost',
        idle_timeout: poolConfiguration.idleTimeoutMillis ? poolConfiguration.idleTimeoutMillis / 1_000 : 0,
        max: 1,
        onnotice: (notice) => {
          connectionEvents.emit('notice', {
            code: notice.code,
            file: notice.file,
            line: notice.line,
            message: notice.message,
            routine: notice.routine,
            severity: notice.severity,
            where: notice.where,
          });
        },
        password: poolConfiguration.password,
        port: poolConfiguration.port ?? 5_432,
        ssl: poolConfiguration.ssl,
        username: poolConfiguration.user,
      }) as AnySql & {events: EventEmitter, };

      connection.events = connectionEvents;

      return connection;
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
        off: connection.events.off.bind(connection.events),
        on: connection.events.on.bind(connection.events),
        query: async (sql: string): Promise<QueryResult> => {
          // https://github.com/porsager/postgres#result-array
          const resultArray = await connection.unsafe(sql);

          return {
            command: resultArray.command as Command,
            fields: resultArray.columns?.map((column) => {
              return {
                dataTypeID: column.type,
                name: column.name,
              };
            }) ?? [],
            rowCount: resultArray.count,
            rows: Array.from(resultArray),
          };
        },
      };

      poolEvents.emit('connect', compatibleConnection);

      return compatibleConnection;
    },
    off: poolEvents.off.bind(poolEvents),
    on: poolEvents.on.bind(poolEvents),
  };
};