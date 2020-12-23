import Model from "../..";
import { castTo } from "../../hacks";
import ORM from "../../ORM";
import { OrmState } from "../../types";
import {
  BookProps,
  CoverProps,
  createTestSessionWithData,
  ExtendedSession,
} from "../helpers";

describe("Mutating session", () => {
  let orm: ORM;
  let state: OrmState;

  beforeEach(() => {
    ({ orm, state } = createTestSessionWithData());
  });

  it("works", () => {
    const mutating = castTo<ExtendedSession>(orm.mutableSession(state));
    const { Book, Cover } = mutating;

    const cover = Cover.create({ src: "somecover.png" });
    const coverId = cover.getId();

    const book = Book.first() as Model;
    const bookRef = book.ref;
    const bookId = book.getId();
    expect(state.Book.itemsById[bookId]).toBe(bookRef);
    const newName = "New Name";

    const bookProps = castTo<BookProps>(book);
    bookProps.name = newName;

    expect(bookProps.name).toBe(newName);

    const nextState = mutating.state;
    expect(nextState).toBe(state);
    expect(state.Book.itemsById[bookId]).toBe(bookRef);
    expect(bookRef.name).toBe(newName);
    expect((state.Cover.itemsById[coverId] as CoverProps).src).toBe(
      "somecover.png"
    );
  });
});
