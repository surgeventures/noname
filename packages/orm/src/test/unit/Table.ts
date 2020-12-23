import deepFreeze from "deep-freeze";
import Table from "../../db/Table";
import { getBatchToken } from "../../utils";
import { FILTER, EXCLUDE, ORDER_BY } from "../../constants";
import { QueryClause, TableRow, TableState, Transaction } from "../../types";
import { BatchToken } from "immutable-ops";

describe("Table", () => {
  describe("prototype methods", () => {
    let state: TableState;
    let batchToken: BatchToken;
    let txInfo: Transaction;
    let table: Table;

    beforeEach(() => {
      state = deepFreeze({
        items: [0, 1, 2],
        itemsById: {
          0: {
            id: 0,
            data: "cooldata",
          },
          1: {
            id: 1,
            data: "verycooldata!",
          },
          2: {
            id: 2,
            data: "awesomedata",
          },
        },
        meta: {},
      });
      batchToken = getBatchToken();
      txInfo = { batchToken, withMutations: false };
      table = new Table();
    });

    it("correctly accesses an id", () => {
      expect(table.accessId(state, 1)).toBe(state.itemsById[1]);
    });

    it("correctly accesses id's", () => {
      expect(table.accessIdList(state)).toBe(state.items);
    });

    it("correctly returns a default state", () => {
      expect(table.getEmptyState()).toEqual({
        items: [],
        itemsById: {},
        meta: {},
      });
    });

    it("correctly inserts an entry", () => {
      const entry = { id: 3, data: "newdata!" };
      const { state: newState, created } = table.insert(txInfo, state, entry);

      expect(created).toBe(entry);

      expect(newState).not.toBe(state);
      expect(newState.items).toEqual([0, 1, 2, 3]);
      expect(newState.itemsById).toEqual({
        0: {
          id: 0,
          data: "cooldata",
        },
        1: {
          id: 1,
          data: "verycooldata!",
        },
        2: {
          id: 2,
          data: "awesomedata",
        },
        3: {
          id: 3,
          data: "newdata!",
        },
      });
    });

    it("correctly updates entries with a merging object", () => {
      const toMergeObj = { data: "modifiedData" };
      const rowsToUpdate = [state.itemsById[1], state.itemsById[2]];
      const newState = table.update(txInfo, state, rowsToUpdate, toMergeObj);

      expect(newState).not.toBe(state);
      expect(newState.items).toBe(state.items);
      expect(newState.itemsById).toEqual({
        0: {
          id: 0,
          data: "cooldata",
        },
        1: {
          id: 1,
          data: "modifiedData",
        },
        2: {
          id: 2,
          data: "modifiedData",
        },
      });
    });

    it("correctly deletes entries", () => {
      const rowsToDelete = [state.itemsById[1], state.itemsById[2]];
      const newState = table.delete(txInfo, state, rowsToDelete);

      expect(newState).not.toBe(state);
      expect(newState.items).toEqual([0]);
      expect(newState.itemsById).toEqual({
        0: {
          id: 0,
          data: "cooldata",
        },
      });
    });

    it("filter works correctly with object argument", () => {
      const clauses: QueryClause[] = [{ type: FILTER, payload: { data: "verycooldata!" } }];
      const result = table.query(state, clauses);
      expect(result).toHaveLength(1);
      expect((result as object[])[0]).toBe(state.itemsById[1]);
    });

    it('filter works correctly with "idAttribute" is "name" and filter argument is a function', () => {
      state = deepFreeze({
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
      });
      table = new Table({ idAttribute: "name" });
      const clauses: QueryClause[] = [
        {
          type: FILTER,
          payload: (attrs: TableRow) =>
            ["work", "urgent"].indexOf(attrs[table.idAttribute]) > -1,
        },
      ];
      const result = table.query(state, clauses);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe(state.itemsById.work);
      expect(result[1]).toBe(state.itemsById.urgent);
    });

    it("orderBy works correctly with prop argument", () => {
      const clauses: QueryClause[] = [{ type: ORDER_BY, payload: [["data"], ["inc"]] }];
      const result = table.query(state, clauses);
      expect(result.map((row) => row.data)).toEqual([
        "awesomedata",
        "cooldata",
        "verycooldata!",
      ]);
    });

    it("orderBy works correctly with function argument", () => {
      const clauses: QueryClause[] = [
        { type: ORDER_BY, payload: [(row: TableRow) => row.data, undefined] },
      ];
      const result = table.query(state, clauses);
      expect(result.map((row) => row.data)).toEqual([
        "awesomedata",
        "cooldata",
        "verycooldata!",
      ]);
    });

    it("exclude works correctly with object argument", () => {
      const clauses: QueryClause[] = [{ type: EXCLUDE, payload: { data: "verycooldata!" } }];
      const result: TableRow[] = table.query(state, clauses) as TableRow[];
      expect(result).toHaveLength(2);
      expect(result.map((row: TableRow) => row.id)).toEqual([0, 2]);
    });

    it("query works with multiple clauses", () => {
      const clauses: QueryClause[] = [
        { type: FILTER, payload: (row: TableRow) => row.id > 0 },
        { type: ORDER_BY, payload: [["data"], ["inc"]] },
      ];
      const result = table.query(state, clauses);
      expect(result.map((row) => row.data)).toEqual([
        "awesomedata",
        "verycooldata!",
      ]);
    });

    it("query works with an id filter for a row which is not in the current result set", () => {
      const clauses: QueryClause[] = [
        { type: FILTER, payload: (row: TableRow) => row.id !== 1 },
        { type: FILTER, payload: { id: 1 } },
      ];
      const result = table.query(state, clauses);
      expect(result).toHaveLength(0);
    });
  });
});
