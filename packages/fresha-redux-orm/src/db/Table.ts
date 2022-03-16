import reject from "lodash/reject";
import filter from "lodash/filter";
import orderBy from "lodash/orderBy";
import sortBy from "lodash/sortBy";
import isNaN from "lodash/isNaN";
import ops, { SetFunc } from "immutable-ops";

import { AnyModel } from "../Model";
import { FILTER, EXCLUDE, ORDER_BY, DEFAULT_TABLE_OPTIONS } from "../constants";
import { clauseFiltersByAttribute, clauseReducesResultSetSize } from "../utils";
import { QueryClause, TableOpts, Ref, TableState, Transaction, ModelId } from "../types";
import { castTo } from "../hacks";

// Input is the current max id and the new id passed to the create action.
// Both may be undefined. The current max id in the case that this is the first Model
// being created, and the new id if the id was not explicitly passed to the
// database.
//
// Return value is the new max id and the id to use to create the new row.
// If the id's are strings, the id must be passed explicitly every time.
// In this case, the current max id will remain `NaN` due to `Math.max`, but that's fine.
export function idSequencer(
  _currMax: undefined | ModelId,
  userPassedId: undefined | null | number | ModelId
): [ModelId, ModelId | null] {
  let currMax: number;
  let newMax: number;
  let newId: number | string | null;

  if (_currMax === undefined) {
    currMax = -1;
  } else {
    currMax = Number(_currMax);
  }

  // no id passed, use the sequence
  if (userPassedId === undefined) {
    newMax = currMax + 1;
    newId = newMax;
  } else if (typeof userPassedId === 'string') {
    // converting to number to see if we have a numeric string
    const num = Number(userPassedId);
    const isValidNumber = !isNaN(num);
    if (isValidNumber && currMax < num) {
      newMax = num;
    } else {
      newMax = currMax;
    }
    newId = userPassedId;
  } else if (typeof userPassedId === 'number') {
    if (currMax < userPassedId) {
      newMax = userPassedId;
    } else {
      newMax = currMax;
    }
    newId = userPassedId;
  } else {
    // handles null
    newMax = currMax;
    newId = userPassedId;
  }

  return [
    String(newMax), // new max id
    typeof newId === 'number' ? String(newId) : newId, // id to use for row creation
  ];
}

/**
 * Handles the underlying data structure for a {@link Model} class.
 */
export default class Table<MClassType extends typeof AnyModel> {
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
  accessId(branch: TableState<MClassType>, id: ModelId) {
    return branch.itemsById[id];
  }

  idExists(branch: TableState<MClassType>, id: ModelId) {
    return branch.itemsById.hasOwnProperty(id);
  }

  accessIdList(branch: TableState<MClassType>) {
    return branch.items;
  }

  accessList(branch: TableState<MClassType>) {
    return branch.items.map((id) => this.accessId(branch, id));
  }

  getMaxId(branch: TableState<MClassType>) {
    return this.getMeta(branch, "maxId");
  }

  setMaxId(tx: Transaction, branch: TableState<MClassType>, newMaxId: ModelId) {
    return this.setMeta(tx, branch, "maxId", newMaxId);
  }

  nextId(id: number) {
    return id + 1;
  }

  query(branch: TableState<MClassType>, clauses: QueryClause[]): Ref<InstanceType<MClassType>>[] {
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

    const initialArray: Ref<InstanceType<MClassType>>[] = [];

    const reducer = (rows: Ref<InstanceType<MClassType>>[], clause: QueryClause): Ref<InstanceType<MClassType>>[] => {
      const { type, payload = {} } = clause;
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
          return filter<Ref<InstanceType<MClassType>>>(rows, payload);
        }
        case EXCLUDE: {
          return reject<Ref<InstanceType<MClassType>>>(rows, payload);
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
  getEmptyState(): TableState<MClassType> {
    return {
      items: [],
      itemsById: {},
      meta: {},
    };
  }

  setMeta(tx: Transaction, branch: TableState<MClassType>, key: string, value: any): TableState<MClassType> {
    const { batchToken, withMutations } = tx;
    if (withMutations) {
      const res = ops.mutable.setIn(["meta", key], value, branch);
      return res as TableState<MClassType>;
    }

    return ops.batch.setIn(batchToken, ["meta", key], value, branch) as TableState<MClassType>;
  }

  getMeta(branch: TableState<MClassType>, key: keyof TableState<MClassType>['meta']) {
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
  insert(tx: Transaction, branch: TableState<MClassType>, entry: Ref<InstanceType<MClassType>>): { state: TableState<MClassType>; created: Ref<InstanceType<MClassType>> } {
    const { batchToken, withMutations } = tx;

    const hasId = castTo<any>(entry).hasOwnProperty(this.idAttribute);

    let workingState = branch;
    let newMaxId = this.getMaxId(branch);
    let id = entry[this.idAttribute] as ModelId | undefined | null;

    if (!hasId || id !== undefined) {
      ([newMaxId, id] = idSequencer(
        newMaxId,
        id
      ));
    }
    workingState = this.setMaxId(tx, branch, newMaxId);
    
    let finalEntry: Ref<InstanceType<MClassType>>;
    if (hasId) {
      finalEntry = entry;
      (finalEntry as { id: ModelId | undefined | null }).id = id;
    } else {
      finalEntry = ops.batch.set(batchToken, this.idAttribute, id, entry) as Ref<InstanceType<MClassType>>;
    }

    if (withMutations) {
      ops.mutable.push(id, workingState.items);
      ops.mutable.set(id as string, finalEntry, workingState.itemsById);
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
          { [id as string]: finalEntry },
          workingState.itemsById
        ),
      },
      workingState
    ) as TableState<MClassType>;

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
  update(tx: Transaction, branch: TableState<MClassType>, rows: Ref<InstanceType<MClassType>>[], mergeObj: object): TableState<MClassType> {
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
    return ops.batch.set(batchToken, "itemsById", newMap, branch) as TableState<MClassType>;
  }
  
  /**
   * Returns the data structure without rows `rows`.
   * @param  {Object} tx - transaction info
   * @param  {Object} branch - the data structure state
   * @param  {Object[]} rows - rows to update
   * @return {Object} the data structure without ids in `idsToDelete`.
   */
  delete(tx: Transaction, branch: TableState<MClassType>, rows: Ref<InstanceType<MClassType>>[]): TableState<MClassType> {
    const { batchToken, withMutations } = tx;

    const arr = branch.items;

    const idsToDelete = rows.map((row) => row[this.idAttribute] as string);
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
    ) as TableState<MClassType>;
  }
}
