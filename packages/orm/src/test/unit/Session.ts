import { ORM } from "../..";
import { AnyModel } from "../../Model";
import { createTestModels, isSubclass, Schema } from "../helpers";
import { CREATE } from "../../constants";
import { OrmState, TableState, UpdateSpec } from "../../types";

describe("Session", () => {
  let orm: ORM<Schema>;
  let Book: Schema['Book'];
  let Cover: Schema['Cover'];
  let Genre: Schema['Genre'];
  let Tag: Schema['Tag'];
  let Author: Schema['Author'];
  let Publisher: Schema['Publisher'];
  let emptyState: OrmState<Schema>;

  beforeEach(() => {
    ({ Book, Cover, Genre, Tag, Author, Publisher } = createTestModels());
    orm = new ORM<Schema>();
    orm.register(Book, Cover, Genre, Tag, Author, Publisher);
    emptyState = orm.getEmptyState();
  });

  it("connects models", () => {
    expect(Book.session).toBeUndefined();
    expect(Cover.session).toBeUndefined();
    expect(Genre.session).toBeUndefined();
    expect(Tag.session).toBeUndefined();
    expect(Cover.session).toBeUndefined();
    expect(Publisher.session).toBeUndefined();

    const session = orm.session();

    expect(session.Book.session).toBe(session);
    expect(session.Cover.session).toBe(session);
    expect(session.Genre.session).toBe(session);
    expect(session.Tag.session).toBe(session);
    expect(session.Cover.session).toBe(session);
    expect(session.Publisher.session).toBe(session);
  });

  it("exposes models as getter properties", () => {
    const session = orm.session();
    expect(isSubclass(session.Book, Book)).toBe(true);
    expect(isSubclass(session.Author, Author)).toBe(true);
    expect(isSubclass(session.Cover, Cover)).toBe(true);
    expect(isSubclass(session.Genre, Genre)).toBe(true);
    expect(isSubclass(session.Tag, Tag)).toBe(true);
    expect(isSubclass(session.Publisher, Publisher)).toBe(true);
  });

  it("marks models when full table scan has been performed", () => {
    const session = orm.session();
    expect(session.fullTableScannedModels).toHaveLength(0);

    session.markFullTableScanned(Book.modelName);
    expect(session.fullTableScannedModels).toHaveLength(1);
    expect(session.fullTableScannedModels[0]).toBe<keyof Schema>("Book");

    session.markFullTableScanned(Book.modelName);

    expect(session.fullTableScannedModels[0]).toBe<keyof Schema>("Book");
  });

  it("marks accessed model instances", () => {
    const session = orm.session();
    expect(session.accessedModelInstances).toEqual<Partial<typeof session.accessedModelInstances>>({});

    session.markAccessed(Book.modelName, [0]);

    expect(session.accessedModelInstances).toEqual<Partial<typeof session.accessedModelInstances>>({
      Book: {
        0: true,
      },
    });

    session.markAccessed(Book.modelName, [1]);
    expect(session.accessedModelInstances).toEqual<Partial<typeof session.accessedModelInstances>>({
      Book: {
        0: true,
        1: true,
      },
    });
  });

  it("throws when failing to apply updates", () => {
    const session = orm.session();
    session.db = {
      ...session.db,
      update() {
        return {
          payload: 123,
          status: "failed",
          state: {},
        } as any;
      },
    };
    expect(() => session.applyUpdate({} as UpdateSpec<Schema>)).toThrow(
      "Applying update failed with status failed. Payload: 123"
    );
  });

  describe("gets the next state", () => {
    it("without any updates, the same state is returned", () => {
      const session = orm.session();
      expect(session.state).toEqual<OrmState<Schema>>(emptyState);
    });

    it("with updates, a new state is returned", () => {
      const session = orm.session(emptyState);

      session.applyUpdate({
        table: Author.modelName,
        action: CREATE,
        payload: {
          id: 0,
          name: "Caesar",
        },
      });

      const nextState = session.state;

      expect(nextState).not.toBe<OrmState<Schema>>(emptyState);

      expect(nextState[Author.modelName]).not.toBe<TableState<typeof Author>>(
        emptyState[Author.modelName]
      );

      // All other model states should stay equal.
      expect(nextState[Book.modelName]).toBe<TableState<typeof Book>>(emptyState[Book.modelName]);
      expect(nextState[Cover.modelName]).toBe<TableState<typeof Cover>>(emptyState[Cover.modelName]);
      expect(nextState[Genre.modelName]).toBe<TableState<typeof Genre>>(emptyState[Genre.modelName]);
      expect(nextState[Tag.modelName]).toBe<TableState<typeof Tag>>(emptyState[Tag.modelName]);
      expect(nextState[Publisher.modelName]).toBe<TableState<typeof Publisher>>(
        emptyState[Publisher.modelName]
      );
    });
  });
});
