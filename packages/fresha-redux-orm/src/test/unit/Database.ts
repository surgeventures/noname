import deepFreeze from "deep-freeze";
import createDatabase from "../../db";
import Table from "../../db/Table";
import { getBatchToken } from "../../utils";
import { FILTER, CREATE, UPDATE, DELETE, SUCCESS } from "../../constants";
import Model from "../../Model";
import { ModelId, OrmState, Query, TableState, UpdateSpec, UpdateStatus, ValidateSchema } from "../../types";
import { Attribute } from "../../decorators";

describe("createDatabase", () => {
  type BookDescriptors = {
    id: ModelId;
    name: string;
  }
  type AuthorDescriptors = {
    id: ModelId;
  }
  class Book extends Model<typeof Book, BookDescriptors> implements BookDescriptors {
    static modelName = "Book" as const;

    @Attribute()
    public id: ModelId;

    @Attribute()
    public name: string;
  }
  class Author extends Model<typeof Author, AuthorDescriptors> implements AuthorDescriptors {
    static modelName = "Author" as const;

    @Attribute()
    public id: ModelId;
  }
  type Schema = ValidateSchema<{
    Book: typeof Book;
    Author: typeof Author;
  }>;

  const schema = {
    tables: {
      Book: {
        idAttribute: "id",
      },
      Author: {
        idAttribute: "id",
      },
    },
  } as const;

  const db = createDatabase<Schema>(schema);
  const emptyState = deepFreeze(db.getEmptyState()) as ReturnType<typeof db.getEmptyState>;

  it("getEmptyState", () => {
    expect(emptyState).toEqual<OrmState<Schema>>({
      Book: {
        items: [],
        itemsById: {},
        meta: {},
      },
      Author: {
        items: [],
        itemsById: {},
        meta: {},
      },
    });
  });

  it("describe", () => {
    const table = db.describe("Book");
    expect(table).toBeInstanceOf(Table);
  });

  it("query on empty database", () => {
    const querySpec: Query<Schema> = {
      table: "Book",
      clauses: [],
    };
    const result = db.query(querySpec, emptyState);
    expect(result.rows).toEqual([]);
  });

  it("insert row with id specified", () => {
    const props = { id: "0", name: "Example Book" };
    const updateSpec: UpdateSpec<Schema, typeof props> = {
      action: CREATE,
      payload: props,
      table: "Book",
    };
    const tx = { batchToken: getBatchToken(), withMutations: false };
    const { status, state, payload } = db.update<typeof props>(updateSpec, tx, emptyState);
    expect(status).toBe<UpdateStatus>(SUCCESS);
    expect(payload).toBe<typeof props>(props);
    expect(state).not.toBe<OrmState<Schema>>(emptyState);
    expect(state).toEqual<OrmState<Schema>>({
      Book: {
        items: ["0"],
        itemsById: {
          0: props,
        },
        meta: {
          maxId: 0,
        },
      },
      Author: {
        items: [],
        itemsById: {},
        meta: {},
      },
    });
  });

  it("insert row to empty database without id (autosequence)", () => {
    const props = { name: "Example Book" };
    const updateSpec: UpdateSpec<Schema, typeof props> = {
      action: CREATE,
      payload: props,
      table: "Book",
    };
    const tx = { batchToken: getBatchToken(), withMutations: false };
    const { status, state, payload } = db.update<typeof props>(updateSpec, tx, emptyState);
    expect(status).toBe<UpdateStatus>(SUCCESS);
    expect(payload).toEqual<typeof props & { id: ModelId }>({ id: "0", name: "Example Book" });
    expect(state).not.toBe<OrmState<Schema>>(emptyState);
    expect(state).toEqual<OrmState<Schema>>({
      Book: {
        items: ["0"],
        itemsById: {
          0: {
            id: "0",
            name: "Example Book",
          },
        },
        meta: {
          maxId: 0,
        },
      },
      Author: {
        items: [],
        itemsById: {},
        meta: {},
      },
    });

    // Second insert.

    const props2 = { name: "Example Book Two" };
    const updateSpec2: UpdateSpec<Schema, typeof props2> = {
      action: CREATE,
      payload: props2,
      table: "Book",
    };
    const { status: status2, state: state2, payload: payload2 } = db.update<typeof props2>(
      updateSpec2,
      tx,
      state
    );

    expect(status2).toBe<UpdateStatus>(SUCCESS);
    expect(payload2).toEqual<typeof props & { id: ModelId }>({ id: "1", name: "Example Book Two" });
    expect(state2).toBe<OrmState<Schema>>(state);
    expect(state2).toEqual<OrmState<Schema>>({
      Book: {
        items: ["0", "1"],
        itemsById: {
          0: {
            id: "0",
            name: "Example Book",
          },
          1: {
            id: "1",
            name: "Example Book Two",
          },
        },
        meta: {
          maxId: 1,
        },
      },
      Author: {
        items: [],
        itemsById: {},
        meta: {},
      },
    });
  });

  it("update row", () => {
    const startState: OrmState<Schema> = {
      Book: {
        items: ["0"],
        itemsById: {
          0: {
            id: "0",
            name: "Example Book",
          },
        },
        meta: {
          maxId: 0,
        },
      },
      Author: {
        items: [],
        itemsById: {},
        meta: {},
      },
    };

    const updateSpec: UpdateSpec<Schema, { name: string }> = {
      action: UPDATE,
      payload: {
        name: "Modified Example Book",
      },
      table: "Book",
      query: {
        table: "Book",
        clauses: [{ type: FILTER, payload: { id: 0 } }],
      },
    };
    const tx = { batchToken: getBatchToken(), withMutations: false };
    const { status, state } = db.update(updateSpec, tx, startState);

    expect(status).toBe<UpdateStatus>(SUCCESS);
    expect(state).not.toBe<OrmState<Schema>>(startState);
    expect(state.Book.itemsById[0].name).toBe("Modified Example Book");
  });

  it("delete row", () => {
    const startState: OrmState<Schema> = {
      Book: {
        items: ["0"],
        itemsById: {
          0: {
            id: "0",
            name: "Example Book",
          },
        },
        meta: {
          maxId: 0,
        },
      },
      Author: {
        items: [],
        itemsById: {},
        meta: {},
      },
    };

    const updateSpec: UpdateSpec<Schema> = {
      action: DELETE,
      table: "Book",
      query: {
        table: "Book",
        clauses: [{ type: FILTER, payload: { id: "0" } }],
      },
    };
    const tx = { batchToken: getBatchToken(), withMutations: false };
    const { status, state } = db.update(updateSpec, tx, startState);

    expect(status).toBe<UpdateStatus>(SUCCESS);
    expect(state).not.toBe<OrmState<Schema>>(startState);
    expect(state.Book.items).toEqual<TableState<typeof Book>['items']>([]);
    expect(state.Book.itemsById).toEqual<TableState<typeof Book>['itemsById']>({});
  });
});
