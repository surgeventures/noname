import { ORM, Model, QuerySet, TargetRelationship, Relations, SourceRelationship, OneToOne, ManyToMany, ForeignKey, attr, many } from "../..";
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

  describe('cascading delete', () => {
    const getModelClasses = () => {
      type YellowDescriptors = {
        id: ModelId;
        name?: string;
        blue?: TargetRelationship<Blue, Relations.ForeignKey>
      }
      class Yellow extends Model<typeof Yellow, YellowDescriptors> {
        static modelName = "Yellow" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;

        @ForeignKey<Yellow>('Blue', 'yellows', { onDelete: 'CASCADE' })
        public blue: TargetRelationship<Blue, Relations.ForeignKey>
      }

      type BlueDescriptors = {
        id: ModelId;
        name?: string;
        yellows?: SourceRelationship<typeof Yellow, Relations.ForeignKey>;
        greens?: SourceRelationship<typeof Green, Relations.ManyToMany>;
      }
      class Blue extends Model<typeof Blue, BlueDescriptors> {
        static modelName = "Blue" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;

        public yellows: SourceRelationship<typeof Yellow, Relations.ForeignKey>;
        public greens: SourceRelationship<typeof Green, Relations.ManyToMany>;
      }

      type GreenDescriptors = {
        id: ModelId;
        name?: string;
        primaryRed?: TargetRelationship<Red, Relations.OneToOne>;
        secondaryRed?: TargetRelationship<Red, Relations.OneToOne>;
        blues?: TargetRelationship<Blue, Relations.ManyToMany>;
      }
      class Green extends Model<typeof Green, GreenDescriptors> {
        static modelName = "Green" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;

        @OneToOne<Green>('Red', 'primaryGreen', { onDelete: 'CASCADE' })
        public primaryRed: TargetRelationship<Red, Relations.OneToOne>;

        @OneToOne<Green>('Red', 'secondaryGreen')
        public secondaryRed: TargetRelationship<Red, Relations.OneToOne>;

        @ManyToMany<Green>('Blue', 'greens', { onDelete: 'CASCADE' })
        public blues: TargetRelationship<Blue, Relations.ManyToMany>;
      }

      type RedDescriptors = {
        id: ModelId;
        name?: string;
        cascadeTargetReds?: TargetRelationship<Red, Relations.ManyToMany>;
        cascadeSourceReds?: SourceRelationship<typeof Red, Relations.ManyToMany>;
        targetReds?: TargetRelationship<Red, Relations.ManyToMany>;
        sourceReds?: SourceRelationship<typeof Red, Relations.ManyToMany>;
        primaryGreen?: SourceRelationship<typeof Green, Relations.OneToOne>;
        secondaryGreen?: SourceRelationship<typeof Green, Relations.OneToOne>;
      }
      class Red extends Model<typeof Red, RedDescriptors> {
        static modelName = "Red" as const;

        @Attribute()
        public id: ModelId;

        @Attribute()
        public name: string;

        @ManyToMany<Red>('Red', 'sourceReds')
        public targetReds: TargetRelationship<Red, Relations.ManyToMany>;

        @ManyToMany<Red>('Red', 'cascadeSourceReds', { onDelete: 'CASCADE' })
        public cascadeTargetReds: TargetRelationship<Red, Relations.ManyToMany>;

        public cascadeSourceReds: SourceRelationship<typeof Red, Relations.ManyToMany>;
        public sourceReds: SourceRelationship<typeof Red, Relations.ManyToMany>;
        public primaryGreen: SourceRelationship<typeof Green, Relations.OneToOne>;
        public secondaryGreen: SourceRelationship<typeof Green, Relations.OneToOne>;
      }
      
      return { Yellow, Blue, Green, Red };
    };
    type Schema = ValidateSchema<{
      Yellow: ReturnType<typeof getModelClasses>['Yellow'];
      Blue: ReturnType<typeof getModelClasses>['Blue'];
      Red: ReturnType<typeof getModelClasses>['Red'];
      Green: ReturnType<typeof getModelClasses>['Green'];
    }>;
    
    let session: SessionWithBoundModels<Schema>;

    beforeEach(() => {
      registry.clear();
      const { Yellow, Blue, Red, Green } = getModelClasses();
      const orm = new ORM<Schema>();
      orm.register(Yellow, Blue, Red, Green);
      session = orm.session();
    }); 

    it("does not remove referenced entities in self-referencing relationship if not using cascade delete", () => {
      const redName = "red";

      const red1 = session.Red.create({ id: "1", name: redName });
      const red2 = session.Red.create({ id: "2", name: redName, targetReds: [red1] });

      red2.delete();

      expect(session.Red.withId("1")).not.toBe(null);
      expect(session.Red.withId("2")).toBe(null);
    });

    it("removes referenced entities in self-referencing relationship if using cascade delete", () => {
      const redName = "red";

      const red1 = session.Red.create({ id: "1", name: redName });
      const red2 = session.Red.create({ id: "2", name: redName, cascadeTargetReds: [red1] });

      red2.delete();

      expect(session.Red.count()).toBe(0);
    });

    it("removes referenced entities in self-referencing relationship if the entity has a foreign key using cascade delete and the default delete mode", () => {
      const redName = "red";

      const red1 = session.Red.create({ id: "1", name: redName });
      const red2 = session.Red.create({ id: "2", name: redName, targetReds: [red1] });
      session.Red.create({ id: "3", name: redName, cascadeTargetReds: [red1] });

      red2.delete();

      expect(session.Red.count()).toBe(2);
    });

    it("removes referenced entities using N-M relation and others that have cascade delete option on", () => {
      const red1 = session.Red.create({ id: "1", name: 'red' });
      const blue1 = session.Blue.create({ id: "3" });
      const blue2 = session.Blue.create({ id: "4" });
      // secondaryRed has cascade disabled
      const green1 = session.Green.create({ id: "1", name: 'greenName', secondaryRed: red1, blues: [blue1, blue2] });

      green1.delete();

      expect(session.Red.count()).toBe(1);
      expect(session.Blue.count()).toBe(0);
      expect(session.Green.count()).toBe(0);
    });

    it("skips cascading removing entities that are not linked", () => {
      const yellow = session.Yellow.create({ id: "1" });
      const blue = session.Blue.create({ id: "2" });
      const green = session.Green.create({ id: "3" });
      const red1 = session.Red.create({ id: "4" });
      const red2 = session.Red.create({ id: "5" });
      
      yellow.delete();

      expect(session.Yellow.count()).toBe(0);
      expect(session.Blue.count()).toBe(1);
      expect(session.Green.count()).toBe(1);
      expect(session.Red.count()).toBe(2);

      blue.delete();

      expect(session.Blue.count()).toBe(0);
      expect(session.Green.count()).toBe(1);
      expect(session.Red.count()).toBe(2);

      green.delete();

      expect(session.Green.count()).toBe(0);
      expect(session.Red.count()).toBe(2);

      red1.delete();

      expect(session.Red.count()).toBe(1);

      red2.delete();

      expect(session.Red.count()).toBe(0);
    });

    it("removes referenced entities using 1-N relation that have cascade delete option on", () => {
      const blue = session.Blue.create({ id: "1" });
      const yellow = session.Yellow.create({ id: "2", blue });
      session.Green.create({ id: "3", blues: [blue] });

      yellow.delete();

      expect(session.Yellow.count()).toBe(0);
      expect(session.Blue.count()).toBe(0);
      expect(session.Green.count()).toBe(1);
    });
  })
});
