import ops from "immutable-ops";

import { CREATE, DELETE, SUCCESS, UPDATE } from "../constants";
import {
  Database,
  OrmState,
  Query,
  SchemaSpec,
  TableMap,
  TableState,
  Transaction,
  UpdateSpec,
  Ref,
} from "../types";

import Table from "./Table";
import { ModelClassMap } from "../Model";
import { Entries, Values } from "../utils";

function replaceTableState<Schema extends ModelClassMap>(
  tableName: keyof Schema,
  newTableState: TableState<Values<Schema>>,
  tx: Transaction,
  state: OrmState<Schema>
): OrmState<Schema> {
  const { batchToken, withMutations } = tx;

  if (withMutations) {
    state[tableName] = newTableState;
    return state;
  }

  return ops.batch.set(batchToken, tableName as string, newTableState, state) as OrmState<Schema>;
}

function query<Schema extends ModelClassMap>(tables: TableMap<Schema>, querySpec: Query<Schema>, state: OrmState<Schema>) {
  const { table: tableName, clauses } = querySpec;
  const table = tables[tableName];
  const rows = table.query(state[tableName], clauses);
  return {
    rows,
  };
}

function update<Schema extends ModelClassMap>(
  tables: TableMap<Schema>,
  updateSpec: UpdateSpec<Schema, Ref<InstanceType<Values<Schema>>>>,
  tx: Transaction,
  state: OrmState<Schema>
  ): { status: typeof SUCCESS; state: OrmState<Schema>; payload: Ref<InstanceType<Values<Schema>>> | Ref<InstanceType<Values<Schema>>>[] } {
  const { action, payload } = updateSpec;

  let tableName: keyof Schema;
  let nextTableState: TableState<Values<Schema>>;
  let resultPayload: Ref<InstanceType<Values<Schema>>> | Ref<InstanceType<Values<Schema>>>[];

  if (action === CREATE) {
    tableName = updateSpec.table!;
    const table = tables[tableName];
    const currTableState = state[tableName];
    const result = table.insert(tx, currTableState, payload || {} as Ref<InstanceType<Values<Schema>>>);
    nextTableState = result.state;
    resultPayload = result.created;
  } else {
    const { query: querySpec } = updateSpec;
    ({ table: tableName } = querySpec!);
    const { rows } = query(tables, querySpec!, state);

    const table = tables[tableName];
    const currTableState = state[tableName];

    if (action === UPDATE) {
      nextTableState = table.update(
        tx,
        currTableState,
        rows,
        payload || {}
      );
      // return updated rows
      resultPayload = query(tables, querySpec!, state).rows;
    } else if (action === DELETE) {
      nextTableState = table.delete(tx, currTableState, rows);
      // return original rows that we just deleted
      resultPayload = rows;
    } else {
      throw new Error(`Database received unknown update type: ${action}`);
    }
  }

  const nextDBState = replaceTableState(tableName, nextTableState, tx, state);
  return {
    status: SUCCESS,
    state: nextDBState,
    payload: resultPayload,
  };
}

export function createDatabase<Schema extends ModelClassMap>(schemaSpec: SchemaSpec<Schema>): Database<Schema> {
  const { tables: tableSpecs } = schemaSpec;
  const tables = (Object.entries(tableSpecs) as Entries<typeof tableSpecs>).reduce(
    (map, [tableName, tableSpec]) => ({
      ...map,
      [tableName]: new Table<Values<Schema>>(tableSpec),
    }),
    {} as TableMap<Schema>
  );

  const getEmptyState = () =>
    (Object.entries(tables) as Entries<typeof tables>).reduce(
      (map, [tableName, table]) => ({
        ...map,
        [tableName]: table.getEmptyState(),
      }),
      {} as OrmState<Schema>
    );
  return {
    getEmptyState,
    query: query.bind(null, tables),
    update: update.bind(null, tables),
    // Used to inspect the schema.
    describe: (tableName: keyof Schema) => tables[tableName],
  };
}

export type DatabaseCreator<Schema extends ModelClassMap> = (schemaSpec: SchemaSpec<Schema>) => Database<Schema>;

export default createDatabase;
