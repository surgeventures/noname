import { ORM, Session, Model, oneToOne, fk, many, attr } from "../..";
import { createTestModels, Schema } from "../helpers";
import { OrmState } from '../../types';

describe("ORM", () => {
  it("constructor works", () => {
    new ORM();
  });

  describe("throws on invalid model declarations", () => {
    it("with multiple one-to-one fields to the same model without related name", () => {
      type Schema = {
        A: typeof A;
        B: typeof B;
      }
      class A extends Model<typeof A> {
        static modelName = "A" as const;
      }

      class B extends Model {
        static modelName = "B" as const;
        static fields = {
          id: attr(),
          field1: oneToOne("A"),
          field2: oneToOne("A"),
        };
      }

      const orm = new ORM<Schema>();
      orm.register(A, B);
      expect(() => orm.getModelClasses()).toThrow(/field/);
    });

    it("with multiple foreign keys to the same model without related name", () => {
      type Schema = {
        A: typeof A;
        B: typeof B;
      }
      class A extends Model<typeof A> {
        static modelName = "A" as const;
      }

      class B extends Model<typeof B> {
        static modelName = "B" as const;
        static fields = {
          id: attr(),
          field1: fk("A"),
          field2: fk("A"),
        };
      }

      const orm = new ORM<Schema>();
      orm.register(A, B);
      expect(() => orm.getModelClasses()).toThrow(/field/);
    });

    it("with multiple many-to-manys to the same model without related name", () => {
      type Schema = {
        A: typeof A;
        B: typeof B;
      }
      class A extends Model<typeof A> {
        static modelName = "A" as const;
      }

      class B extends Model<typeof B> {
        static modelName = "B" as const;
        static fields = {
          id: attr(),
          field1: many("A"),
          field2: many("A"),
        };
      }

      const orm = new ORM<Schema>();
      orm.register(A, B);
      expect(() => orm.getModelClasses()).toThrow(/field/);
    });

    it("correctly throws an error when a model does not have a modelName property", () => {
      type Schema = { A: typeof A };
      class A extends Model<typeof A> {}
      const orm = new ORM<Schema>();
      expect(() => orm.register(A)).toThrow(
        "A model was passed that doesn't have a modelName set"
      );
    });
  });

  describe("simple orm", () => {
    let orm: ORM<Schema>;
    let Book: Schema['Book'];
    let Author: Schema['Author'];
    let Cover: Schema['Cover'];
    let Genre: Schema['Genre'];
    let Tag: Schema['Tag'];
    let Publisher: Schema['Publisher'];

    beforeEach(() => {
      ({ Book, Author, Cover, Genre, Tag, Publisher } = createTestModels());
      orm = new ORM<Schema>();
    });

    it("correctly registers a single model at a time", () => {
      expect(orm.registry).toHaveLength(0);
      orm.register(Book);
      expect(orm.registry).toHaveLength(1);
      orm.register(Author);
      expect(orm.registry).toHaveLength(2);
    });

    it("correctly registers multiple models", () => {
      expect(orm.registry).toHaveLength(0);
      orm.register(Book, Author);
      expect(orm.registry).toHaveLength(2);
    });

    it("correctly starts session", () => {
      const initialState = {} as OrmState<Schema>;
      const session = orm.session(initialState);
      expect(session).toBeInstanceOf(Session);
    });

    it("correctly gets models from registry", () => {
      orm.register(Book);
      expect(orm.get("Book")).toBe<typeof Book>(Book);
    });

    it("throws when trying to get inexistant model from registry", () => {
      expect(() => orm.get("InexistantModel" as any)).toThrow(
        "Did not find model InexistantModel from registry."
      );
    });

    it("correctly sets model prototypes", () => {
      orm.register(Book, Author, Cover, Genre, Tag, Publisher);
      expect(Book.isSetUp).toBeFalsy();

      let coverDescriptor = Object.getOwnPropertyDescriptor(
        Book.prototype,
        "cover"
      );
      expect(coverDescriptor).toBeUndefined();
      let authorDescriptor = Object.getOwnPropertyDescriptor(
        Book.prototype,
        "author"
      );
      expect(authorDescriptor).toBeUndefined();
      let genresDescriptor = Object.getOwnPropertyDescriptor(
        Book.prototype,
        "genres"
      );
      expect(genresDescriptor).toBeUndefined();

      let tagsDescriptor = Object.getOwnPropertyDescriptor(
        Book.prototype,
        "tags"
      );
      expect(tagsDescriptor).toBeUndefined();

      let publisherDescriptor = Object.getOwnPropertyDescriptor(
        Book.prototype,
        "publisher"
      );
      expect(publisherDescriptor).toBeUndefined();

      orm._setupModelPrototypes(orm.registry);
      orm._setupModelPrototypes(orm.implicitThroughModels);

      expect(Book.isSetUp).toBeTruthy();

      coverDescriptor = Object.getOwnPropertyDescriptor(
        Book.prototype,
        "cover"
      );
      expect(typeof coverDescriptor?.get).toBe("function");
      expect(typeof coverDescriptor?.set).toBe("function");

      authorDescriptor = Object.getOwnPropertyDescriptor(
        Book.prototype,
        "author"
      );
      expect(typeof authorDescriptor?.get).toBe("function");
      expect(typeof authorDescriptor?.set).toBe("function");

      genresDescriptor = Object.getOwnPropertyDescriptor(
        Book.prototype,
        "genres"
      );
      expect(typeof genresDescriptor?.get).toBe("function");
      expect(typeof genresDescriptor?.set).toBe("function");

      tagsDescriptor = Object.getOwnPropertyDescriptor(
        Book.prototype,
        "tags"
      );
      expect(typeof tagsDescriptor?.get).toBe("function");
      expect(typeof tagsDescriptor?.set).toBe("function");

      publisherDescriptor = Object.getOwnPropertyDescriptor(
        Book.prototype,
        "publisher"
      );
      expect(typeof publisherDescriptor?.get).toBe("function");
      expect(typeof publisherDescriptor?.set).toBe("function");
    });

    it("correctly gets the default state", () => {
      orm.register(Book, Author, Cover, Genre, Tag, Publisher);
      const defaultState = orm.getEmptyState();

      expect(defaultState).toEqual<Omit<OrmState<Schema>, 'Movie'>>({
        Book: {
          items: [],
          itemsById: {},
          meta: {},
        },
        BookGenres: {
          items: [],
          itemsById: {},
          meta: {},
        },
        BookTags: {
          items: [],
          itemsById: {},
          meta: {},
        },
        Author: {
          items: [],
          itemsById: {},
          meta: {},
        },
        Cover: {
          items: [],
          itemsById: {},
          meta: {},
        },
        Genre: {
          items: [],
          itemsById: {},
          meta: {},
        },
        Tag: {
          items: [],
          itemsById: {},
          meta: {},
        },
        TagSubTags: {
          items: [],
          itemsById: {},
          meta: {},
        },
        Publisher: {
          items: [],
          itemsById: {},
          meta: {},
        },
      });
    });

    it("correctly starts a mutating session", () => {
      orm.register(Book, Author, Cover, Genre, Tag, Publisher);
      const initialState = orm.getEmptyState();
      const session = orm.mutableSession(initialState);
      expect(session).toBeInstanceOf(Session);
      expect(session.withMutations).toBe(true);
    });
  });
});
