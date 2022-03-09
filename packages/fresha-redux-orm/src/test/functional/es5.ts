import ORM from "../../ORM";
import Model from "../../Model";
import { ModelId, SessionBoundModel, SessionWithBoundModels, ValidateSchema } from "../../types";
import { Attribute } from "../../decorators";

describe("ES5 library code", () => {
  describe("With ES6 client code", () => {
    type BookDescriptors = {
      id: ModelId;
      title: string;
    }
    class Book extends Model<typeof Book, BookDescriptors> implements BookDescriptors {
      static readonly modelName = "Book";

      @Attribute()
      public id: ModelId;

      @Attribute()
      public title: string;
    }
    type Schema = ValidateSchema<{
      Book: typeof Book;
    }>;
    let orm: ORM<Schema>;
    let session: SessionWithBoundModels<Schema>;

    beforeEach(() => {
      orm = new ORM<Schema>();
      orm.register(Book);
      session = orm.session();
    });

    it("Model CRUD works", () => {
      let book: SessionBoundModel<Book>;

      expect(() => {
        book = session.Book.create({
          id: "1",
          title: "title",
        });
      }).not.toThrow();
      expect(() => {
        book.update({ id: "1", title: "new title" });
      }).not.toThrow();
    });
  });
});
