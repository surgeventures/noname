import ORM from "../../ORM";
import { OrmState } from "../../types";
import { createTestSessionWithData, ExtendedSession, Schema } from "../helpers";

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

    firstSession.Book.create({
      name: "New Book",
      author: "0",
      releaseYear: 2015,
      genres: ["0", "1"],
    });

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
