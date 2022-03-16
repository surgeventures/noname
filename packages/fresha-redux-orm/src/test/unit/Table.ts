import deepFreeze from "deep-freeze";
import { BatchToken } from "immutable-ops";

import Table, { idSequencer } from "../../db/Table";
import { getBatchToken } from "../../utils";
import { FILTER, EXCLUDE, ORDER_BY } from "../../constants";
import { ModelId, QueryClause, Ref, RefFromFields, TableState, Transaction } from "../../types";
import Model from "../../Model";

describe("Table", () => {
  describe("prototype methods", () => {
    type TestDescriptors = {
      id?: ModelId;
      data?: string;
    };
    class Test extends Model<typeof Test, TestDescriptors> {}

    let state: TableState<typeof Test>;
    let batchToken: BatchToken;
    let txInfo: Transaction;
    let table: Table<typeof Test>;

    beforeEach(() => {
      const stateObj = {
        items: ["0", "1", "2"],
        itemsById: {
          0: {
            id: "0",
            data: "cooldata",
          },
          1: {
            id: "1",
            data: "verycooldata!",
          },
          2: {
            id: "2",
            data: "awesomedata",
          },
        },
        meta: {},
      };
      state = deepFreeze(stateObj) as typeof stateObj;
      batchToken = getBatchToken();
      txInfo = { batchToken, withMutations: false };
      table = new Table<typeof Test>();
    });

    it("correctly accesses an id", () => {
      expect(table.accessId(state, "1")).toBe<TableState<typeof Test>['itemsById'][number]>(state.itemsById[1]);
    });

    it("correctly accesses id's", () => {
      expect(table.accessIdList(state)).toBe<TableState<typeof Test>['items']>(state.items);
    });

    it("correctly returns a default state", () => {
      expect(table.getEmptyState()).toEqual<TableState<typeof Test>>({
        items: [],
        itemsById: {},
        meta: {},
      });
    });

    it("correctly inserts an entry", () => {
      const entry = { id: "3", data: "newdata!" };
      const { state: newState, created } = table.insert(txInfo, state, entry);

      expect(created).toBe<Ref<Test>>(entry);

      expect(newState).not.toBe<TableState<typeof Test>>(state);
      expect(newState.items).toEqual<TableState<typeof Test>['items']>(["0", "1", "2", "3"]);
      expect(newState.itemsById).toEqual<TableState<typeof Test>['itemsById']>({
        0: {
          id: "0",
          data: "cooldata",
        },
        1: {
          id: "1",
          data: "verycooldata!",
        },
        2: {
          id: "2",
          data: "awesomedata",
        },
        3: {
          id: "3",
          data: "newdata!",
        },
      });
    });

    it("correctly inserts an entry with null as id", () => {
      const entry = { id: null, data: "newdata!" } as unknown as RefFromFields<TestDescriptors>;
      const { state: newState, created } = table.insert(txInfo, state, entry);

      expect(created).toBe<Ref<Test>>(entry);

      expect(newState).not.toBe<TableState<typeof Test>>(state);
      expect(newState.items).toEqual(["0", "1", "2", null]);
      expect(newState.itemsById).toEqual<TableState<typeof Test>['itemsById']>({
        0: {
          id: "0",
          data: "cooldata",
        },
        1: {
          id: "1",
          data: "verycooldata!",
        },
        2: {
          id: "2",
          data: "awesomedata",
        },
        null: {
          id: null as unknown as string,
          data: "newdata!",
        },
      });
    });

    it("correctly inserts an entry with undefined as id", () => {
      const entry = { id: undefined, data: "newdata!" } as unknown as RefFromFields<TestDescriptors>;
      const { state: newState, created } = table.insert(txInfo, state, entry);

      expect(created).toBe<Ref<Test>>(entry);

      expect(newState).not.toBe<TableState<typeof Test>>(state);
      expect(newState.items).toEqual(["0", "1", "2", undefined]);
      expect(newState.itemsById).toEqual<TableState<typeof Test>['itemsById']>({
        0: {
          id: "0",
          data: "cooldata",
        },
        1: {
          id: "1",
          data: "verycooldata!",
        },
        2: {
          id: "2",
          data: "awesomedata",
        },
        undefined: {
          id: undefined as unknown as string,
          data: "newdata!",
        },
      });
    });

    it("correctly updates entries with a merging object", () => {
      const extendedState = deepFreeze({
        ...state,
        items: state.items.concat([null, undefined] as unknown as string[]),
        itemsById: {
          ...state.itemsById,
          null: {
            id: null as unknown as string,
            data: "newdata!",
          },
          undefined: {
            id: undefined,
            data: "newdata!",
          },
        }
      });
      const toMergeObj: Ref<Test> = { data: "modifiedData" };
      const rowsToUpdate = [extendedState.itemsById[1], extendedState.itemsById[2], extendedState.itemsById['null'], extendedState.itemsById['undefined']] as RefFromFields<TestDescriptors>[];
      const newState = table.update(txInfo, state, rowsToUpdate, toMergeObj);

      expect(newState).not.toBe<TableState<typeof Test>>(state);
      expect(newState.items).toBe<TableState<typeof Test>['items']>(state.items);
      expect(newState.itemsById).toEqual<TableState<typeof Test>['itemsById']>({
        0: {
          id: "0",
          data: "cooldata",
        },
        1: {
          id: "1",
          data: "modifiedData",
        },
        2: {
          id: "2",
          data: "modifiedData",
        },
        null: {
          id: null as unknown as string,
          data: "modifiedData",
        },
        undefined: {
          id: undefined,
          data: "modifiedData",
        },
      });
    });

    it("correctly deletes entries", () => {
      const extendedState = deepFreeze({
        ...state,
        items: state.items.concat([null, undefined] as unknown as string[]),
        itemsById: {
          ...state.itemsById,
          null: {
            id: null as unknown as string,
            data: "newdata!",
          },
          undefined: {
            id: undefined,
            data: "newdata!",
          },
        }
      });
      const rowsToDelete = [extendedState.itemsById[1], extendedState.itemsById[2], extendedState.itemsById['null'], extendedState.itemsById['undefined']] as RefFromFields<TestDescriptors>[];
      const newState = table.delete(txInfo, extendedState, rowsToDelete);
      const expectedItemsById = {
        0: {
          id: "0",
          data: "cooldata",
        },
      };

      expect(newState).not.toBe<TableState<typeof Test>>(state);
      expect(newState.items).toEqual<TableState<typeof Test>['items']>(["0"]);
      expect(newState.itemsById).toEqual<TableState<typeof Test>['itemsById']>(expectedItemsById);
    });

    it("filter works correctly with object argument", () => {
      const extendedState = deepFreeze({
        ...state,
        items: state.items.concat([null, undefined] as unknown as string[]),
        itemsById: {
          ...state.itemsById,
          null: {
            id: null as unknown as string,
            data: "newdata!",
          },
          undefined: {
            id: undefined,
            data: "newdata!",
          },
        }
      });
      const clauses: QueryClause<{ data: string }>[] = [{ type: FILTER, payload: { data: "verycooldata!" } }];
      const result = table.query(extendedState, clauses);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe<TableState<typeof Test>['itemsById'][number]>(state.itemsById[1]);
    });

    it('filter works correctly with "idAttribute" is "name" and filter argument is a function', () => {
      type TestDescriptors = {
        name: string;
      }
      type TableStateItemsById = TableState<typeof Test>['itemsById'];
      class Test extends Model<typeof Test, TestDescriptors> {}
      const stateObj: TableState<typeof Test> = {
        items: ["work", "personal", "urgent"],
        itemsById: {
          work: {
            name: "work",
          },
          personal: {
            name: "personal",
          },
          urgent: {
            name: "urgent",
          },
        },
        meta: {},
      };
      const state = deepFreeze(stateObj) as typeof stateObj;
      const table = new Table<typeof Test>({ idAttribute: "name" });
      const clauses: QueryClause<(attrs: Ref<Test>) => boolean>[] = [
        {
          type: FILTER,
          payload: attrs =>
            ["work", "urgent"].indexOf((attrs as any)[table.idAttribute]) > -1,
        },
      ];
      const result = table.query(state, clauses);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe<TableStateItemsById[keyof TableStateItemsById]>(state.itemsById.work);
      expect(result[1]).toBe<TableStateItemsById[keyof TableStateItemsById]>(state.itemsById.urgent);
    });

    it("orderBy works correctly with prop argument", () => {
      const extendedState = deepFreeze({
        ...state,
        items: state.items.concat([null, undefined] as unknown as string[]),
        itemsById: {
          ...state.itemsById,
          null: {
            id: null as unknown as string,
            data: "newdata!",
          },
          undefined: {
            id: undefined,
            data: "newdata!",
          },
        }
      });
      const clauses: QueryClause<[string[], string[]]>[] = [{ type: ORDER_BY, payload: [["data"], ["inc"]] }];
      const result = table.query(extendedState, clauses);
      expect(result.map((row) => row.data)).toEqual<Ref<Test>['data'][]>([
        "awesomedata",
        "cooldata",
        "newdata!",
        "newdata!",
        "verycooldata!",
      ]);
    });

    it("orderBy works correctly with function argument", () => {
      const clauses: QueryClause<[(row: Ref<Test>) => Ref<Test>['data'], undefined]>[] = [
        { type: ORDER_BY, payload: [row => row.data, undefined] },
      ];
      const result = table.query(state, clauses);
      expect(result.map((row) => row.data)).toEqual<Ref<Test>['data'][]>([
        "awesomedata",
        "cooldata",
        "verycooldata!",
      ]);
    });

    it("exclude works correctly with object argument", () => {
      const extendedState = deepFreeze({
        ...state,
        items: state.items.concat([null, undefined] as unknown as string[]),
        itemsById: {
          ...state.itemsById,
          null: {
            id: null as unknown as string,
            data: "newdata!",
          },
          undefined: {
            id: undefined,
            data: "newdata!",
          },
        }
      });
      const clauses: QueryClause<{ data: string }>[] = [{ type: EXCLUDE, payload: { data: "verycooldata!" } }];
      const result = table.query(extendedState, clauses);
      expect(result).toHaveLength(4);
      expect(result.map((row) => row.id)).toEqual(["0", "2", null, undefined]);
    });

    it("query works with multiple clauses", () => {
      const clauses: (QueryClause<(row: Ref<Test>) => boolean> | QueryClause<[string[], string[]]>)[] = [
        { type: FILTER, payload: row => Number(row.id!) > 0 },
        { type: ORDER_BY, payload: [["data"], ["inc"]] },
      ];
      const result = table.query(state, clauses);
      expect(result.map((row) => row.data)).toEqual<Ref<Test>['data'][]>([
        "awesomedata",
        "verycooldata!",
      ]);
    });

    it("query works with an id filter for a row which is not in the current result set", () => {
      const extendedState = deepFreeze({
        ...state,
        items: state.items.concat([null, undefined] as unknown as string[]),
        itemsById: {
          ...state.itemsById,
          null: {
            id: null as unknown as string,
            data: "newdata!",
          },
          undefined: {
            id: undefined,
            data: "newdata!",
          },
        }
      });
      const clauses: (QueryClause<(row: Ref<Test>) => boolean> | QueryClause<Ref<Test>>)[] = [
        { type: FILTER, payload: row => row.id !== "1" },
        { type: FILTER, payload: { id: "1" } },
      ];
      const result = table.query(extendedState, clauses);
      expect(result).toHaveLength(0);
    });
  });
});

describe('idSequencer', () => {
  it('null as passed id', () => {
    const nullWithCurrMax = idSequencer("1", null);
    const nullWithoutCurrMax = idSequencer(undefined, null);

    expect(nullWithCurrMax).toEqual(["1", null]);
    expect(nullWithoutCurrMax).toEqual(["-1", null]);
  });
  it('undefined as passed id', () => {
    const undefinedWithCurrMax = idSequencer("1", undefined);
    const undefinedWithoutCurrMax = idSequencer(undefined, undefined);

    expect(undefinedWithCurrMax).toEqual(["2", "2"]);
    expect(undefinedWithoutCurrMax).toEqual(["0", "0"]);
  });
  it('number as passed id', () => {
    const numberWithLowerCurrMax = idSequencer("1", 2);
    const numberWithoutCurrMax = idSequencer(undefined, 2);
    const numberWithEqualCurrMax = idSequencer("1", 1);

    expect(numberWithLowerCurrMax).toEqual(["2", "2"]);
    expect(numberWithoutCurrMax).toEqual(["2", "2"]);
    expect(numberWithEqualCurrMax).toEqual(["1", "1"]);
  });
  it('numeric string as passed id', () => {
    const numericStrWithLowerCurrMax = idSequencer("1", "2");
    const numericStrWithoutCurrMax = idSequencer(undefined, "2");
    const numericStrWithEqualCurrMax = idSequencer("1", "1");

    expect(numericStrWithLowerCurrMax).toEqual(["2", "2"]);
    expect(numericStrWithoutCurrMax).toEqual(["2", "2"]);
    expect(numericStrWithEqualCurrMax).toEqual(["1", "1"]);
  });
  it('random string as passed id', () => {
    const strWithCurrMax = idSequencer("1", "asd");
    const strWithoutCurrMax = idSequencer(undefined, "asd");

    expect(strWithCurrMax).toEqual(["1", "asd"]);
    expect(strWithoutCurrMax).toEqual(["-1", "asd"]);
  });
})
