import { ORM, Model, QuerySet, TargetRelationship, Relations, SourceRelationship, attr, many } from "../..";
import { castTo } from "../../hacks";
import { ModelId, SessionWithBoundModels, ValidateSchema } from "../../types";
import { Attribute } from "../../decorators";
import { ModelDescriptorsRegistry } from "../../modelDescriptorsRegistry";

const registry = ModelDescriptorsRegistry.getInstance();

describe("Model", () => {
  const getTestModelClass = () => {
    type TestDescriptors = {
      id?: ModelId;
    }
    class Test extends Model<typeof Test, TestDescriptors> implements TestDescriptors {
      static modelName = "UnitTestModel" as const;

      @Attribute()
      public id?: ModelId;
    }
    
    return { Test };
  };
  
  describe("static method", () => {
    type Schema = ValidateSchema<{
      UnitTestModel: ReturnType<typeof getTestModelClass>['Test'];
    }>;
    
    let Test: ReturnType<typeof getTestModelClass>['Test'];
    let sessionMock: SessionWithBoundModels<Schema>;
    
    beforeEach(() => {
      registry.clear();
      ({ Test } = getTestModelClass());
      const orm = new ORM<Schema>();
      orm.register(Test);
      sessionMock = orm.session();
    });

    it("make sure instance methods are enumerable", () => {
      const enumerableProps: Record<keyof typeof Test, boolean> = {} as Record<keyof typeof Test, boolean>;
      for (const propName in Test) {
        enumerableProps[propName as keyof typeof Test] = true;
      }

      expect(enumerableProps.modelName).toBe(true);
    });

    it("session getter works correctly", () => {
      expect(Test.session).toBeUndefined();
      Test._session = sessionMock;
      expect(Test.session).toBe<SessionWithBoundModels<Schema>>(sessionMock);
    });

    it("connect defines session statically on Model", () => {
      expect(Test.session).toBeUndefined();
      Test.connect(sessionMock);
      expect(Test.session).toBe<SessionWithBoundModels<Schema>>(sessionMock);
    });

    it("connect throws if not passing a session", () => {
      expect(Model.session).toBeUndefined();
      [1, "", [], {}].forEach((value) =>
        expect(() => {
          Model.connect(value as any);
        }).toThrow("A model can only be connected to instances of Session.")
      );
    });

    it("toString works correctly", () => {
      expect(Test.toString()).toBe("ModelClass: UnitTestModel");
    });

    it("query returns QuerySet", () => {
      expect(Test.query).toBeInstanceOf(QuerySet);
    });

    it("getQuerySet returns QuerySet", () => {
      expect(Test.getQuerySet()).toBeInstanceOf(QuerySet);
    });

    it("all returns QuerySet", () => {
      expect(Test.all()).toBeInstanceOf(QuerySet);
    });

    it("markAccessed correctly proxies to Session", () => {
      Test.connect(sessionMock);
      Test.markAccessed(["1", "3"]);
      expect(sessionMock.accessedModelInstances).toEqual<Record<keyof Schema, Record<ModelId, boolean>>>({
        UnitTestModel: {
          1: true,
          3: true,
        },
      });
    });

    it("markFullTableScanned correctly proxies to Session", () => {
      Test.connect(sessionMock);
      Test.markFullTableScanned();
      expect(sessionMock.fullTableScannedModels).toEqual<(keyof Schema)[]>(["UnitTestModel"]);
    });

    it("should throw a custom error when user try to interact with database without a session", () => {
      const attributes = {
        id: "0",
        name: "Tommi",
        number: 123,
        boolean: false,
      };
      expect(() => Test.create(attributes)).toThrow(
        'Tried to create a UnitTestModel model instance without a session. Create a session using `session = orm.session()` and call `session["UnitTestModel"].create` instead.'
      );
      expect(() => Test.upsert(attributes)).toThrow(
        'Tried to upsert a UnitTestModel model instance without a session. Create a session using `session = orm.session()` and call `session["UnitTestModel"].upsert` instead.'
      );
      expect(() => Test.exists(attributes)).toThrow(
        'Tried to check if a UnitTestModel model instance exists without a session. Create a session using `session = orm.session()` and call `session["UnitTestModel"].exists` instead.'
      );
      expect(() => Test.withId("0")).toThrow(
        'Tried to get the UnitTestModel model\'s id attribute without a session. Create a session using `session = orm.session()` and access `session["UnitTestModel"].idAttribute` instead.'
      );
      expect(() => new Test({}).update(attributes)).toThrow(
        "Tried to update a UnitTestModel model instance without a session. You cannot call `.update` on an instance that you did not receive from the database."
      );
      expect(() => new Test({}).delete()).toThrow(
        "Tried to delete a UnitTestModel model instance without a session. You cannot call `.delete` on an instance that you did not receive from the database."
      );
    });
  });

  describe("Instance methods", () => {
    type TestDescriptors = {
      id: ModelId;
      name?: string;
      number?: number;
      boolean?: boolean;
      array?: any[];
      object?: {};
    }
    type Schema = ValidateSchema<{
      UnitTestModel: ReturnType<typeof getTestModelClass>['Test'];
    }>;
    const getTestModelClass = () => {
      class Test extends Model<typeof Test, TestDescriptors> implements TestDescriptors {
        static modelName = "UnitTestModel" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name?: string;

        @Attribute()
        public number?: number;

        @Attribute()
        public boolean?: boolean;

        @Attribute()
        public array?: any[];

        @Attribute()
        public object?: {};
      }

      return { Test };
    };

    let Test: ReturnType<typeof getTestModelClass>['Test'];

    beforeEach(() => {
      ({ Test } = getTestModelClass());
      const orm = new ORM<Schema>();
      orm.register(Test);
    });

    it("getClass works correctly", () => {
      const instance = new Test({
        id: "0",
        name: "Tommi",
        array: [],
        object: {},
        number: 123,
        boolean: false,
      });
      expect(instance.getClass()).toBe(Test);
    });

    it("equals compares primitive types correctly", () => {
      const instance1 = new Test({
        id: "0",
        name: "Tommi",
        number: 123,
        boolean: true,
      });
      const instance2 = new Test({
        id: "0",
        name: "Tommi",
        number: 123,
        boolean: true,
      });
      expect(instance1.equals(instance2)).toBeTruthy();
      const instance3 = new Test({
        id: "0",
        name: "Tommi",
        number: 123,
        boolean: false,
      });
      expect(instance1.equals(instance3)).toBeFalsy();
    });

    it("equals does not deeply compare array fields", () => {
      const instance1 = new Test({ id: "0", array: [] });
      const instance2 = new Test({ id: "0", array: [] });
      expect(instance1.equals(instance2)).toBeFalsy();
    });

    it("equals does not deeply compare object fields", () => {
      const instance1 = new Test({ id: "0", object: {} });
      const instance2 = new Test({ id: "0", object: {} });
      expect(instance1.equals(instance2)).toBeFalsy();
    });

    it("constructing with random attributes assigns these attributes", () => {
      const randomNumber = Math.random();
      const model = new Test({
        randomNumber,
        someString: "some string",
      } as any);
      expect(castTo<{ randomNumber: string }>(model).randomNumber).toBe(
        randomNumber
      );
      expect(castTo<{ someString: string }>(model).someString).toBe(
        "some string"
      );
    });
  });

  describe("backwards compatibility for static fields object", () => {
    const getModelClasses = () => {
      type BookDescriptors = {
        id: ModelId;
        name: string;
        authors: TargetRelationship<Author, Relations.ManyToMany>
      }
      class Book extends Model<typeof Book, BookDescriptors> {
        static modelName = "Book" as const;
        static fields = {
          id: attr(),
          name: attr(),
          authors: many('Author', 'books')
        }
        // declared authors field to have correct typing
        public authors: TargetRelationship<Author, Relations.ManyToMany>
      }

      type AuthorDescriptors = {
        id: ModelId;
        name: string;
        books?: SourceRelationship<typeof Book, Relations.ManyToMany>
      }
      class Author extends Model<typeof Author, AuthorDescriptors> {
        static modelName = "Author" as const;
        static fields = {
          id: attr(),
          name: attr()
        }
      }
      
      return { Book, Author };
    };
    type Schema = ValidateSchema<{
      Book: ReturnType<typeof getModelClasses>['Book'];
      Author: ReturnType<typeof getModelClasses>['Author'];
    }>;
    
    let Book: Schema['Book'];
    let Author: Schema['Author'];
    let session: SessionWithBoundModels<Schema>;

    beforeEach(() => {
      registry.clear();
      ({ Book, Author } = getModelClasses());
      const orm = new ORM<Schema>();
      orm.register(Book, Author);
      session = orm.session();
    });

    it("able to create a model with static fields object", () => {
      const bookName = 'book';
      const authorName = "author";

      session.Author.create({ id: "1", name: authorName });
      session.Book.create({ id: "2", name: bookName, authors: [session.Author.first()!]});

      const book = session.Book.first()!;

      expect(book.ref.name).toBe(bookName);
      expect(book.authors?.first()!.ref.name).toBe(authorName);
    })
  });
});
