import ORM from "../../ORM";
import Session from "../../Session";
import Model from "../../Model";
import { castTo } from "../../hacks";

describe("ES5 library code", () => {
  describe("With ES6 client code", () => {
    let orm: ORM;
    let session: Session;
    beforeEach(() => {
      class Book extends Model {
        static modelName = "Book";
      }
      orm = new ORM();
      orm.register(Book);
      session = orm.session();
    });
    it("Model CRUD works", () => {
      let book: Model;
      expect(() => {
        type SessionWithBook = {
          Book: typeof Model;
        };

        book = castTo<SessionWithBook>(session).Book.create({
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
