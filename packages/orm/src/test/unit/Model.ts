import { ORM, Model, QuerySet, attr } from "../..";
import { AnyModel } from "../../Model";
import { ModelDescriptorsRegistry, registerDescriptors } from '../../Model';
import { castTo } from "../../hacks";
import { ModelId, SessionWithBoundModels } from "../../types";


const registry = ModelDescriptorsRegistry.getInstance();
registry.clear();

describe("Model", () => {
  const getTestModelClass = () => {
    return class Test extends Model<typeof Test, {}> {
      static modelName = "UnitTestModel" as const;
    };
  };

  describe("static method", () => {
    type Schema = {
      UnitTestModel: ReturnType<typeof getTestModelClass>;
    };

    let TestModel: ReturnType<typeof getTestModelClass>;
    let sessionMock: SessionWithBoundModels<Schema>;

    beforeEach(() => {
      TestModel = getTestModelClass();
      const orm = new ORM<Schema>();
      orm.register(TestModel);
      sessionMock = orm.session();
    });

    it("make sure instance methods are enumerable", () => {
      const enumerableProps: Record<keyof typeof TestModel, boolean> = {} as Record<keyof typeof TestModel, boolean>;
      for (const propName in TestModel) {
        enumerableProps[propName as keyof typeof TestModel] = true;
      }

      expect(enumerableProps.modelName).toBe(true);
      expect(enumerableProps.create).toBe(true);
    });

    it("session getter works correctly", () => {
      expect(TestModel.session).toBeUndefined();
      TestModel._session = sessionMock;
      expect(TestModel.session).toBe<SessionWithBoundModels<Schema>>(sessionMock);
    });

    it("connect defines session statically on Model", () => {
      expect(TestModel.session).toBeUndefined();
      TestModel.connect(sessionMock);
      expect(TestModel.session).toBe<SessionWithBoundModels<Schema>>(sessionMock);
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
      expect(TestModel.toString()).toBe("ModelClass: UnitTestModel");
    });

    it("query returns QuerySet", () => {
      expect(TestModel.query).toBeInstanceOf(QuerySet);
    });

    it("getQuerySet returns QuerySet", () => {
      expect(TestModel.getQuerySet()).toBeInstanceOf(QuerySet);
    });

    it("all returns QuerySet", () => {
      expect(TestModel.all()).toBeInstanceOf(QuerySet);
    });

    it("markAccessed correctly proxies to Session", () => {
      TestModel.connect(sessionMock);
      TestModel.markAccessed([1, 3]);
      expect(sessionMock.accessedModelInstances).toEqual<Record<keyof Schema, Record<ModelId, boolean>>>({
        UnitTestModel: {
          1: true,
          3: true,
        },
      });
    });

    it("markFullTableScanned correctly proxies to Session", () => {
      TestModel.connect(sessionMock);
      TestModel.markFullTableScanned();
      expect(sessionMock.fullTableScannedModels).toEqual<(keyof Schema)[]>(["UnitTestModel"]);
    });

    it("should throw a custom error when user try to interact with database without a session", () => {
      const attributes = {
        id: 0,
        name: "Tommi",
        number: 123,
        boolean: false,
      };
      expect(() => TestModel.create(attributes)).toThrow(
        'Tried to create a UnitTestModel model instance without a session. Create a session using `session = orm.session()` and call `session["UnitTestModel"].create` instead.'
      );
      expect(() => TestModel.upsert(attributes)).toThrow(
        'Tried to upsert a UnitTestModel model instance without a session. Create a session using `session = orm.session()` and call `session["UnitTestModel"].upsert` instead.'
      );
      expect(() => TestModel.exists(attributes)).toThrow(
        'Tried to check if a UnitTestModel model instance exists without a session. Create a session using `session = orm.session()` and call `session["UnitTestModel"].exists` instead.'
      );
      expect(() => TestModel.withId(0)).toThrow(
        'Tried to get the UnitTestModel model\'s id attribute without a session. Create a session using `session = orm.session()` and access `session["UnitTestModel"].idAttribute` instead.'
      );
      expect(() => new TestModel({}).update(attributes)).toThrow(
        "Tried to update a UnitTestModel model instance without a session. You cannot call `.update` on an instance that you did not receive from the database."
      );
      expect(() => new TestModel({}).delete()).toThrow(
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
    type Schema = {
      UnitTestModel: ReturnType<typeof getTestModelClass>;
    }
    const getTestModelClass = () => {
      return class Test extends Model<typeof Test, TestDescriptors> {
        static modelName = "UnitTestModel" as const;
        static fields = {
          id: attr(),
          name: attr(),
          number: attr(),
          boolean: attr(),
          array: attr(),
          object: attr(),
        };
      };
    };

    let TestModel: ReturnType<typeof getTestModelClass>;

    beforeEach(() => {
      TestModel = getTestModelClass();
      const orm = new ORM<Schema>();
      orm.register(TestModel);
    });

    it("getClass works correctly", () => {
      const instance = new TestModel({
        id: 0,
        name: "Tommi",
        array: [],
        object: {},
        number: 123,
        boolean: false,
      });
      expect(instance.getClass()).toBe(TestModel);
    });

    it("equals compares primitive types correctly", () => {
      const instance1 = new TestModel({
        id: 0,
        name: "Tommi",
        number: 123,
        boolean: true,
      });
      const instance2 = new TestModel({
        id: 0,
        name: "Tommi",
        number: 123,
        boolean: true,
      });
      expect(instance1.equals(instance2)).toBeTruthy();
      const instance3 = new TestModel({
        id: 0,
        name: "Tommi",
        number: 123,
        boolean: false,
      });
      expect(instance1.equals(instance3)).toBeFalsy();
    });

    it("equals does not deeply compare array fields", () => {
      const instance1 = new TestModel({ id: 0, array: [] });
      const instance2 = new TestModel({ id: 0, array: [] });
      expect(instance1.equals(instance2)).toBeFalsy();
    });

    it("equals does not deeply compare object fields", () => {
      const instance1 = new TestModel({ id: 0, object: {} });
      const instance2 = new TestModel({ id: 0, object: {} });
      expect(instance1.equals(instance2)).toBeFalsy();
    });

    it("constructing with random attributes assigns these attributes", () => {
      const randomNumber = Math.random();
      const model = new TestModel({
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
});
