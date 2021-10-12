import { castTo } from "../../hacks";
import ORM from "../../ORM";
import { OrmState } from "../../types";
import { createTestSessionWithData, ExtendedSession } from "../helpers";

describe("Multiple concurrent sessions", () => {
  let session: ExtendedSession;
  let orm: ORM;
  let state: OrmState;

  beforeEach(() => {
    const result = createTestSessionWithData();
    session = castTo<ExtendedSession>(result.session);
    orm = result.orm;
    state = result.state;
  });

  it("separate sessions can manage separate data stores", () => {
    const firstSession: ExtendedSession = session;
    const secondSession = castTo<ExtendedSession>(orm.session(state));

    expect(firstSession.Book.count()).toBe(3);
    expect(secondSession.Book.count()).toBe(3);

    const newBookProps = {
      name: "New Book",
      author: 0,
      releaseYear: 2015,
      genres: [0, 1],
    };

    firstSession.Book.create(newBookProps);

    expect(firstSession.Book.count()).toBe(4);
    expect(secondSession.Book.count()).toBe(3);
  });

  it("separate sessions have different session bound models", () => {
    const firstSession = castTo<ExtendedSession>(orm.session());
    const secondSession = castTo<ExtendedSession>(orm.session());

    expect(firstSession.Book).not.toBe(secondSession.Book);
    expect(firstSession.Author).not.toBe(secondSession.Author);
    expect(firstSession.Genre).not.toBe(secondSession.Genre);
    expect(firstSession.Tag).not.toBe(secondSession.Tag);
    expect(firstSession.Cover).not.toBe(secondSession.Cover);
    expect(firstSession.Publisher).not.toBe(secondSession.Publisher);
  });
});
