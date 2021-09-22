import reject from "lodash/reject";
import filter from "lodash/filter";
import orderBy from "lodash/orderBy";
import sortBy from "lodash/sortBy";
import ops, { SetFunc } from "immutable-ops";

import { AnyModel } from "../Model";
import { FILTER, EXCLUDE, ORDER_BY, DEFAULT_TABLE_OPTIONS } from "../constants";
import { clauseFiltersByAttribute, clauseReducesResultSetSize } from "../utils";
import { QueryClause, TableOpts, Row, TableState, Transaction, ModelId } from "../types";

// Input is the current max id and the new id passed to the create action.
// Both may be undefined. The current max id in the case that this is the first Model
// being created, and the new id if the id was not explicitly passed to the
// database.
//
// Return value is the new max id and the id to use to create the new row.
// If the id's are strings, the id must be passed explicitly every time.
// In this case, the current max id will remain `NaN` due to `Math.max`, but that's fine.
function idSequencer(
  _currMax: undefined | number,
  userPassedId: undefined | number
): [number, number] {
  let currMax = _currMax;
  let newMax;
  let newId;

  if (currMax === undefined) {
    currMax = -1;
  }

  if (userPassedId === undefined) {
    newMax = currMax + 1;
    newId = newMax;
  } else {
    newMax = Math.max(currMax + 1, userPassedId);
    newId = userPassedId;
  }

  return [
    newMax, // new max id
    newId, // id to use for row creation
  ];
}

/**
 * Handles the underlying data structure for a {@link Model} class.
 */
export default class Table<MClass extends typeof AnyModel> {
  readonly idAttribute: string;

  /**
   * Creates a new {@link Table} instance.
   * @param  {Object} userOpts - options to use.
   * @param  {string} [userOpts.idAttribute=id] - the id attribute of the entity.
   */
  constructor(userOpts?: TableOpts) {
    Object.assign(this, DEFAULT_TABLE_OPTIONS, userOpts);
  }

  /**
   * Returns a reference to the object at index `id`
   * in state `branch`.
   *
   * @param  {Object} branch - the state
   * @param  {Number} id - the id of the object to get
   * @return {Object|undefined} A reference to the raw object in the state or
   *                            `undefined` if not found.
   */
  accessId(branch: TableState<MClass>, id: ModelId) {
    return branch.itemsById[id];
  }

  idExists(branch: TableState<MClass>, id: ModelId) {
    return branch.itemsById.hasOwnProperty(id);
  }

  accessIdList(branch: TableState<MClass>) {
    return branch.items;
  }

  accessList(branch: TableState<MClass>) {
    return branch.items.map((id) => this.accessId(branch, id));
  }

  getMaxId(branch: TableState<MClass>) {
    return this.getMeta(branch, "maxId");
  }

  setMaxId(tx: Transaction, branch: TableState<MClass>, newMaxId: number) {
    return this.setMeta(tx, branch, "maxId", newMaxId);
  }

  nextId(id: number) {
    return id + 1;
  }

  query(branch: TableState<MClass>, clauses: QueryClause[]): Row<MClass>[] {
    if (clauses.length === 0) {
      return this.accessList(branch);
    }

    const { idAttribute } = this;

    const optimallyOrderedClauses = sortBy(clauses, (clause) => {
      if (clauseFiltersByAttribute(clause, idAttribute)) {
        return 1;
      }

      if (clauseReducesResultSetSize(clause)) {
        return 2;
      }

      return 3;
    });

    const initialArray: Row<MClass>[] = [];

    const reducer = (rows: Row<MClass>[], clause: QueryClause): Row<MClass>[] => {
      const { type, payload } = clause;
      if (rows === initialArray) {
        if (clauseFiltersByAttribute(clause, idAttribute)) {
          const id = (payload as Record<string, any>)[idAttribute];
          // Payload specified a primary key; Since that is
          // unique, we can directly return that.
          return this.idExists(branch, id) ? [this.accessId(branch, id)] : [];
        }

        return reducer(this.accessList(branch), clause);
      }

      switch (type) {
        case FILTER: {
          return filter<Row<MClass>>(rows, payload);
        }
        case EXCLUDE: {
          return reject<Row<MClass>>(rows, payload);
        }
        case ORDER_BY: {
          const [iteratees, orders] = payload as [string[], string[]];
          return orderBy(rows, iteratees, orders);
        }
        default:
          return rows;
      }
    };

    return optimallyOrderedClauses.reduce(reducer, initialArray);
  }

  /**
   * Returns the default state for the data structure.
   * @return {Object} The default state for this {@link Backend} instance's data structure
   */
  getEmptyState(): TableState<MClass> {
    return {
      items: [],
      itemsById: {},
      meta: {},
    };
  }

  setMeta(tx: Transaction, branch: TableState<MClass>, key: string, value: any): TableState<MClass> {
    const { batchToken, withMutations } = tx;
    if (withMutations) {
      const res = ops.mutable.setIn(["meta", key], value, branch);
      return res as TableState<MClass>;
    }

    return ops.batch.setIn(batchToken, ["meta", key], value, branch) as TableState<MClass>;
  }

  getMeta(branch: TableState<MClass>, key: keyof TableState<MClass>['meta']) {
    return branch.meta[key];
  }

  /**
   * Returns the data structure including a new object `entry`
   * @param  {Object} tx - transaction info
   * @param  {Object} branch - the data structure state
   * @param  {Object} entry - the object to insert
   * @return {Object} an object with two keys: `state` and `created`.
   *                  `state` is the new table state and `created` is the
   *                  row that was created.
   */
  insert(tx: Transaction, branch: TableState<MClass>, entry: Row<MClass>): { state: TableState<MClass>; created: Row<MClass> } {
    const { batchToken, withMutations } = tx;

    const hasId = entry.hasOwnProperty(this.idAttribute);

    let workingState = branch;

    // This will not affect string id's.
    const [newMaxId, id] = idSequencer(
      this.getMaxId(branch),
      entry[this.idAttribute]
    );
    workingState = this.setMaxId(tx, branch, newMaxId);

    const finalEntry = hasId
      ? entry
      : ops.batch.set(batchToken, this.idAttribute, id, entry) as Row<MClass>;

    if (withMutations) {
      ops.mutable.push(id, workingState.items);
      ops.mutable.set(String(id), finalEntry, workingState.itemsById);
      return {
        state: workingState,
        created: finalEntry,
      };
    }

    const nextState = ops.batch.merge(
      batchToken,
      {
        items: ops.batch.push(batchToken, id, workingState.items),
        itemsById: ops.batch.merge(
          batchToken,
          { [id]: finalEntry },
          workingState.itemsById
        ),
      },
      workingState
    ) as TableState<MClass>;

    return {
      state: nextState,
      created: finalEntry,
    };
  }

  /**
   * Returns the data structure with objects where `rows`
   * are merged with `mergeObj`.
   *
   * @param  {Object} tx - transaction info
   * @param  {Object} branch - the data structure state
   * @param  {Object[]} rows - rows to update
   * @param  {Object} mergeObj - The object to merge with each row.
   * @return {Object}
   */
  update(tx: Transaction, branch: TableState<MClass>, rows: Row<MClass>[], mergeObj: object): TableState<MClass> {
    const { batchToken, withMutations } = tx;

    const mapFunction = (row: object) => {
      const merge = withMutations
        ? ops.mutable.merge
        : ops.batch.merge(batchToken);
      return merge(mergeObj, row);
    };

    const set = withMutations ? ops.mutable.set : ops.batch.set(batchToken);

    const newMap = rows.reduce((map, row) => {
      const result = mapFunction(row);
      return (set as SetFunc)(result[this.idAttribute], result, map);
    }, branch.itemsById);
    return ops.batch.set(batchToken, "itemsById", newMap, branch) as TableState<MClass>;
  }
  
  /**
   * Returns the data structure without rows `rows`.
   * @param  {Object} tx - transaction info
   * @param  {Object} branch - the data structure state
   * @param  {Object[]} rows - rows to update
   * @return {Object} the data structure without ids in `idsToDelete`.
   */
  delete(tx: Transaction, branch: TableState<MClass>, rows: Row<MClass>[]): TableState<MClass> {
    const { batchToken, withMutations } = tx;

    const arr = branch.items;

    const idsToDelete = rows.map((row) => row[this.idAttribute]);
    if (withMutations) {
      idsToDelete.forEach((id) => {
        const idx = arr.indexOf(id);
        if (idx !== -1) {
          ops.mutable.splice(idx, 1, [], arr);
        }

        ops.mutable.omit(id, branch.itemsById);
      });
      return branch;
    }

    return ops.batch.merge(
      batchToken,
      {
        items: ops.batch.filter(
          batchToken,
          (id) => !idsToDelete.includes(id),
          branch.items
        ),
        itemsById: ops.batch.omit(batchToken, idsToDelete, branch.itemsById),
      },
      branch
    ) as TableState<MClass>;
  }
}
