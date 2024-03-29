/* eslint-disable @typescript-eslint/no-explicit-any */

import genericPool, {
  type Pool as GenericPool,
} from 'generic-pool';
import {
  EventEmitter,
} from 'node:events';
import type Postgres from 'postgres';
import {
  Roarr,
} from 'roarr';
import {
  serializeError,
} from 'serialize-error';

const log = Roarr.child({
  package: 'postgres-bridge',
});

type PgPool = {
  database?: string,
  host?: string,
  idleTimeoutMillis?: number,
  max?: number,
  min?: number,
  password?: string,
  port?: number,
  ssl?: boolean,
  types?: {
    getTypeParser: (id: number, format?: string) => any,
  },
  user?: string,
};

type Command = 'DELETE' | 'INSERT' | 'SELECT' | 'UPDATE';

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

declare class NotAPromise {
  // eslint-disable-next-line unicorn/no-thenable
  private then (): never;
  private catch (): never;
  private finally (): never;
}

type Parameter<T = SerializableParameter> = NotAPromise & {
  /**
   * Raw value to serialize
   */
  raw: T | null,
  /**
   * PostgreSQL OID of the type
   */
  type: number,
  /**
   * Serialized value
   */
  value: string | null,
};

type Serializable = Date | Uint8Array | boolean | never | number | string | null;

type ArrayParameter<T extends readonly any[] = readonly any[]> = Parameter<T | T[]> & {
  array: true,
};

type SerializableParameter<T = never> = ArrayParameter | Parameter<any> | ReadonlyArray<SerializableParameter<T>> | Serializable | T | never;

type TypeParser = {
  from: number[],
  parse: (value: any) => any,
};

export type BridgetClient = {
  end: () => Promise<void>,
  off: (eventName: string, listener: (...args: any[]) => void) => void,
  on: (eventName: string, listener: (...args: any[]) => void) => void,
  query: (sql: string, parameters?: SerializableParameter[]) => Promise<QueryResult>,
  release: () => Promise<void>,
};

export const createPostgresBridge = (postgres: typeof Postgres) => {
  return class PostgresBridge {
    public readonly poolEvents: EventEmitter;

    public readonly pool: GenericPool<BridgetClient>;

    public constructor (poolConfiguration: PgPool) {
      this.poolEvents = new EventEmitter();

      let types: TypeParser[];

      this.pool = genericPool.createPool<BridgetClient>({
        create: async () => {
          const connectionEvents = new EventEmitter();

          if (poolConfiguration.types && !types) {
            const sql = postgres({
              database: poolConfiguration.database,
              fetch_types: false,
              host: poolConfiguration.host ?? 'localhost',
              max: 1,
              password: poolConfiguration.password,
              port: poolConfiguration.port ?? 5_432,
              ssl: poolConfiguration.ssl,
              username: poolConfiguration.user,
            });

            const pgTypes = await sql`select typname, oid, typarray from pg_type order by oid`;

            // eslint-disable-next-line require-atomic-updates
            types = [];

            for (const pgType of pgTypes) {
              let typeParser;

              try {
                typeParser = poolConfiguration.types.getTypeParser(pgType.oid);
              } catch (error) {
                log.error({
                  error: serializeError(error),
                }, 'could not get type parser');
              }

              if (typeParser) {
                types.push({
                  from: [
                    pgType.oid,
                  ],
                  parse: typeParser,
                });
              }
            }
          }

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
            types: types as any,
            username: poolConfiguration.user,
          });

          const compatibleConnection = {
            end: async () => {
              await this.pool.destroy(compatibleConnection);
            },
            off: connectionEvents.off.bind(connectionEvents),
            on: connectionEvents.on.bind(connectionEvents),
            query: async (sql: string, parameters?: SerializableParameter[]): Promise<QueryResult> => {
              // https://github.com/porsager/postgres#result-array
              const resultArray = await connection.unsafe(sql, parameters as any);

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
            release: async (remove: boolean = false) => {
              if (remove) {
                await this.pool.destroy(compatibleConnection);
              } else {
                await this.pool.release(compatibleConnection);
              }
            },
          };

          return compatibleConnection;
        },
        destroy: async (client: BridgetClient) => {
          await client.end();
        },
      }, {
        max: poolConfiguration.max ?? 10,
        min: poolConfiguration.min ?? 0,
      });
    }

    public async connect () {
      const connection = await this.pool.acquire();

      this.poolEvents.emit('connect', connection);

      return connection;
    }

    public _pulseQueue () {
      // TODO implement logic equivalent to https://github.com/brianc/node-postgres/blob/master/packages/pg-pool/index.js#L109-L152
    }

    public async _remove (client: BridgetClient) {
      await this.pool.destroy(client);

      this.poolEvents.emit('remove', client);
    }

    public get _clients (): BridgetClient[] {
      // @ts-expect-error accessing private method
      return Array.from<{obj: BridgetClient, }>(this.pool._allObjects, (member) => {
        return member.obj;
      });
    }

    public get idleCount () {
      return this.pool.available;
    }

    public off (eventName: string, listener: (...args: any[]) => void) {
      return this.poolEvents.off(eventName, listener);
    }

    public on (eventName: string, listener: (...args: any[]) => void) {
      return this.poolEvents.on(eventName, listener);
    }

    public get totalCount () {
      return this.pool.size;
    }

    public get waitingCount () {
      return this.pool.pending;
    }

    public async end () {
      await this.pool.clear();
    }
  };
};
