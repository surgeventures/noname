import ORM from "../../ORM";
import { OrmState, Ref } from "../../types";
import {
  createTestSessionWithData,
  Schema,
} from "../helpers";

describe("Mutating session", () => {
  let orm: ORM<Schema>;
  let state: OrmState<Schema>;

  beforeEach(() => {
    ({ orm, state } = createTestSessionWithData());
  });

  it("works", () => {
    const mutating = orm.mutableSession(state);
    const { Book, Cover } = mutating;

    const cover = Cover.create({ src: "somecover.png" });
    const coverId = cover.getId();

    const book = Book.first()!;
    const bookRef = book.ref;
    const bookId = book.getId();
    expect(state.Book.itemsById[bookId]).toBe<Ref<InstanceType<Schema['Book']>>>(bookRef);
    const newName = "New Name";

    const bookProps = book;
    bookProps.name = newName;

    expect(bookProps.name).toBe(newName);

    const nextState = mutating.state;
    expect(nextState).toBe(state);
    expect(state.Book.itemsById[bookId]).toBe<Ref<InstanceType<Schema['Book']>>>(bookRef);
    expect(bookRef.name).toBe(newName);
    expect(state.Cover.itemsById[coverId].src).toBe(
      "somecover.png"
    );
  });
});
