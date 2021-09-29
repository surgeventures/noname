import ORM from "../../ORM";
import { ModelAttrs, OrmState } from "../../types";
import { BookDescriptors, createTestSessionWithData, ExtendedSession, Schema } from "../helpers";

describe("Multiple concurrent sessions", () => {
  let session: ExtendedSession;
  let orm: ORM<Schema>;
  let state: OrmState<Schema>;

  beforeEach(() => {
    const result = createTestSessionWithData();
    session = result.session;
    orm = result.orm;
    state = result.state;
  });

  it("separate sessions can manage separate data stores", () => {
    const firstSession = session;
    const secondSession = orm.session(state);

    expect(firstSession.Book.count()).toBe(3);
    expect(secondSession.Book.count()).toBe(3);

    // ERROR: ModelAttrs got broken
    const newBookProps: ModelAttrs<BookDescriptors> = {
      name: "New Book",
      author: 0,
      releaseYear: 2015,
      genres: [0, 1],
    };

    // ERROR: create should infer the type of fields from the model itself
    firstSession.Book.create(newBookProps);

    expect(firstSession.Book.count()).toBe(4);
    expect(secondSession.Book.count()).toBe(3);
  });

  it("separate sessions have different session bound models", () => {
    const firstSession = orm.session();
    const secondSession = orm.session();

    expect(firstSession.Book).not.toBe(secondSession.Book);
    expect(firstSession.Author).not.toBe(secondSession.Author);
    expect(firstSession.Genre).not.toBe(secondSession.Genre);
    expect(firstSession.Tag).not.toBe(secondSession.Tag);
    expect(firstSession.Cover).not.toBe(secondSession.Cover);
    expect(firstSession.Publisher).not.toBe(secondSession.Publisher);
  });
});
