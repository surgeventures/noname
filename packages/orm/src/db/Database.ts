import ops from "immutable-ops";

import { CREATE, DELETE, SUCCESS, UPDATE } from "../constants";
import { castTo } from "../hacks";
import {
  Database,
  OrmState,
  Query,
  SchemaSpec,
  TableMap,
  TableState,
  Transaction,
  UpdateCreateSpec,
  UpdateSpec,
} from "../types";

import Table from "./Table";

function replaceTableState(
  tableName: string,
  newTableState: TableState,
  tx: Transaction,
  state: OrmState
) {
  const { batchToken, withMutations } = tx;

  if (withMutations) {
    state[tableName] = newTableState;
    return state;
  }

  return ops.batch.set(batchToken, tableName, newTableState, state);
}

function query(tables: TableMap, querySpec: Query, state: OrmState) {
  const { table: tableName, clauses } = querySpec;
  const table = tables[tableName];
  const rows = table.query(state[tableName], clauses);
  return {
    rows,
  };
}

function update(
  tables: TableMap,
  updateSpec: UpdateSpec,
  tx: Transaction,
  state: OrmState
) {
  const { action, payload } = updateSpec;

  let tableName;
  let nextTableState;
  let resultPayload;

  if (action === CREATE) {
    ({ table: tableName } = castTo<UpdateCreateSpec>(updateSpec));
    const table = tables[tableName];
    const currTableState = state[tableName];
    const result = table.insert(tx, currTableState, payload);
    nextTableState = result.state;
    resultPayload = result.created;
  } else {
    const { query: querySpec } = updateSpec;
    ({ table: tableName } = querySpec as Query);
    const { rows } = query(tables, querySpec as Query, state);

    const table = tables[tableName];
    const currTableState = state[tableName];

    if (action === UPDATE) {
      nextTableState = table.update(
        tx,
        currTableState,
        rows as object[],
        payload
      );
      // return updated rows
      resultPayload = query(tables, querySpec as Query, state).rows;
    } else if (action === DELETE) {
      nextTableState = table.delete(tx, currTableState, rows as object[]);
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

export function createDatabase(schemaSpec: SchemaSpec): Database {
  const { tables: tableSpecs } = schemaSpec;
  const tables: TableMap = Object.entries(tableSpecs).reduce(
    (map, [tableName, tableSpec]) => ({
      ...map,
      [tableName]: new Table(tableSpec),
    }),
    {}
  );

  const getEmptyState = () =>
    Object.entries(tables).reduce(
      (map, [tableName, table]) => ({
        ...map,
        [tableName]: table.getEmptyState(),
      }),
      {}
    );

  const injectTables = (newSchemaSpec: SchemaSpec) => {
    const { tables: newTableSpecs } = newSchemaSpec;
    const newEmptyState: OrmState = {};
    Object.entries(newTableSpecs).forEach(
      ([tableName, tableSpec]) => {
        const newTable = new Table(tableSpec);
        tables[tableName] = newTable;
        newEmptyState[tableName] = newTable.getEmptyState();
      }
    );
    return newEmptyState;
  };

  return {
    getEmptyState,
    injectTables,
    query: query.bind(null, tables),
    update: update.bind(null, tables),
    // Used to inspect the schema.
    describe: (tableName: string) => tables[tableName],
  };
}

export type DatabaseCreator = typeof createDatabase;

export default createDatabase;
