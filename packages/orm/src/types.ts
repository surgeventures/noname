import { BatchToken } from "immutable-ops";

import {
  CREATE,
  DELETE,
  EXCLUDE,
  FAILURE,
  FILTER,
  ORDER_BY,
  SUCCESS,
  UPDATE,
} from "./constants";
import Table from "./db/Table";

/**
 * A primitive value
 */
export type Primitive = number | string | boolean;

/**
 * Serializable value: a primitive, undefined, a serializable object or an array of those
 */
export type Serializable =
  | Primitive
  | Primitive[]
  | undefined
  | {
      [K: string]: Serializable | Serializable[];
    };

export type TableState = {
  meta: {
    [k: string]: any;
  };
  items: ModelId[];
  itemsById: Record<ModelId, Record<string, any>>;
};

export type OrmState = Record<string, TableState>;

/**
 * A type of {@link QueryClause}.
 */
export type QueryType = typeof FILTER | typeof EXCLUDE | typeof ORDER_BY;

/**
 * A single `QueryClause`.
 * Multiple `QueryClause`s can be combined into a {@link Query}.
 */
export interface QueryClause<Payload extends object = {}> {
  type: QueryType;
  payload: Payload;
}

/**
 * Query definition, contains target table and a collection of {@link QueryClause}.
 */
export interface Query {
  table: string;
  clauses: QueryClause[];
}

/**
 * Query wrapper definition, wraps {@link Query}.
 */
export interface QuerySpec {
  query: Query;
}

/**
 * Query result.
 */
export interface QueryResult<Row extends Record<string, Serializable> = {}> {
  rows: ReadonlyArray<Row>;
}

/**
 * A type of data update to perform.
 */
export type UpdateType = typeof CREATE | typeof UPDATE | typeof DELETE;

/**
 * A status of data update operation.
 */
export type UpdateStatus = typeof SUCCESS | typeof FAILURE;

/**
 * Data update definition
 */
export interface UpdateSpec<Payload = any> {
  table?: string;
  action: UpdateType;
  payload?: Payload;
  query?: Query;
}

export type UpdateCreateSpec = {
  table: string;
};

/**
 * Data update result.
 */
export interface UpdateResult {
  status: UpdateStatus;
  state: OrmState;
  payload: object;
}

/**
 * Transactions aggregate batches of operations.
 */
export interface Transaction {
  batchToken: BatchToken;
  withMutations: boolean;
}

export type TableRow = Record<string, any>;

export interface Database {
  describe(modelName: string): Table;
  getEmptyState(): OrmState;
  query(query: Query, state: OrmState): { rows: TableRow[] };
  update(
    updateSpec: UpdateSpec,
    tx: Transaction,
    state: OrmState
  ): { status: string; state: OrmState; payload: object };
  injectTables(schemaSpec: SchemaSpec): OrmState;
}

export type ModelId = number | string;
export type ModelData = Record<string, any>;
export type ObjectMap<T> = Record<string, T>;

/**
 * {@link TableOpts} used for {@link Table} customization.
 *
 * Supplied via {@link Model#options}.
 *
 * If no customizations were provided, the table uses following default options:
 * <br/>
 * ```typescript
 *  {
 *      idAttribute: 'id',
 *  }
 * ```
 * <br/>
 *  @see {@link Model}
 *  @see {@link Model#options}
 *  @see {@link OrmState}
 */
export interface TableOpts {
  readonly idAttribute?: string;
  //   readonly fields?: { [K: string]: Field };
}

export type TableSpec = TableOpts & {};

export type SchemaSpec = {
  tables: {
    [tableName: string]: TableSpec;
  };
};

export type ReduxAction<T = any> = {
  type: string;
  payload: T;
};

export type ForEachCallback<T> = {
  (elem: T): void;
};

export type WithForEach<T> = {
  forEach: (cb: ForEachCallback<T>) => void;
}

export type TableMap = Record<string, Table>;

export type EqualityFunc = (arg1: any, arg2: any) => boolean;
