import ORM from "../../ORM";
import Model from "../../Model";
import { ModelId, ModelInstance, SessionLike } from "../../types";

describe("ES5 library code", () => {
  describe("With ES6 client code", () => {
    type BookDescriptors = {
      id: ModelId;
      title: string;
    }
    class Book extends Model<typeof Book, BookDescriptors> {
      static modelName = "Book";
    }
    type Schema = {
      Book: typeof Book;
    };
    let orm: ORM<Schema>;
    let session: SessionLike<Schema>;

    beforeEach(() => {
      orm = new ORM<Schema>();
      orm.register(Book);
      session = orm.session();
    });

    it("Model CRUD works", () => {
      let book: ModelInstance<Book>;

      expect(() => {
        book = session.Book.create({
          id: 1,
          title: "title",
        });
      }).not.toThrow();
      expect(() => {
        book.update({ id: 1, title: "new title" });
      }).not.toThrow();
    });
  });
});
