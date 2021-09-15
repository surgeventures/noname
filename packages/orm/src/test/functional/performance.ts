import { Model, ORM, attr, many, QuerySet } from "../..";
import { AnyModel, ModelDescriptorsRegistry, registerDescriptors, SessionBoundModel } from '../../Model';
import { ModelId, Relations, SessionBoundModel, SessionWithBoundModels, TargetRelationship, SourceRelationship } from "../../types";
import { measureMs, nTimes, avg, round } from "../helpers";
import { Attribute } from "../../decorators/attribute";
import { ManyToMany } from "../../decorators/manyToMany";
import { ForeignKey } from "../../decorators/foreignKey";
import { OneToOne } from "../../decorators/oneToOne";

const crypto = require("crypto");

const PRECISION = 2;
const print = (msg: string) => console.log(msg);
const createTimeLog = (
  message: string,
  tookSeconds: number,
  maxSeconds: number,
  measurements: number[]
) => {
  let out = `${message} took ${tookSeconds}s / ${maxSeconds}s`;
  if (measurements) {
    const measurementSeconds = measurements
      .map((m) => round(m, PRECISION))
      .map((m) => `${m}s`)
      .join(", ");
    out += ` on average (${measurementSeconds} each)`;
  }
  return out;
};

const randomName = (): string => crypto.randomBytes(16).toString("hex");

describe("Big Data Test", () => {
  type ExtendedSession = {
    Location: typeof Model;
  };

  let orm: ORM;
  let session: ExtendedSession;

  beforeEach(() => {
    const registry = ModelDescriptorsRegistry.getInstance();
    registry.clear()
    class Location extends Model {
      static modelName = "Location";

      @Attribute
      public id: string;

      @Attribute
      public name: string;
    }

    registerDescriptors("Item" as any, {
      id: attr(),
      name: attr(),
    })
  type ItemDescriptors = {
    id: ModelId;
    name: string;
  }
  class Item extends Model<typeof Item, ItemDescriptors> implements ItemDescriptors {
    static modelName = "Item";
    static fields = {
      id: attr(),
      name: attr(),
    };

    id: ModelId;
    name: string;
  }

  type Schema = {
    Item: typeof Item;
  }
  type ExtendedSession = SessionWithBoundModels<Schema>;

  let orm: ORM<Schema>;
  let session: ExtendedSession;

  beforeEach(() => {
    orm = new ORM();
    orm.register(Location);
    session = orm.session(orm.getEmptyState());
  });

  it("adds a big amount of Locations in acceptable time", () => {
    const { Location } = session;

    const maxSeconds = process.env.TRAVIS ? 10 : 2;
    const n = 5;
    const amount = 50000;
    const Locations = new Map(
      nTimes(amount * n).map((_value, index) => [
        index,
        {
          id: index,
          name: randomName(),
        },
      ])
    );

    const measurements = nTimes(n)
      .map((_value, index) => {
        const start = index * amount;
        const end = start + amount;
        return measureMs(() => {
          for (let i = start; i < end; ++i) {
            Location.create(Locations.get(i)!);
          }
        });
      })
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    print(createTimeLog(
      `Creating ${amount} objects`,
      tookSeconds,
      maxSeconds,
      measurements
    ));
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("looks up Locations by id in a large table in acceptable time", () => {
    const { Location } = session;

    const maxSeconds = process.env.TRAVIS ? 5 : 2;
    const n = 5;
    const lookupCount = 50000;
    const rowCount = n * lookupCount;

    for (let i = 0; i < rowCount; ++i) {
      Location.create({
        id: i,
        name: randomName(),
      });
    }

    const measurements = nTimes(n)
      .map((_value, index) => {
        const start = index * lookupCount;
        const end = start + lookupCount;
        return measureMs(() => {
          for (let i = start; i < end; ++i) {
            Location.withId(i);
          }
        });
      })
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    print(createTimeLog(
      `Looking up ${lookupCount} objects by id`,
      tookSeconds,
      maxSeconds,
      measurements
    ));
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });
});

describe("Many-to-many relationship performance", () => {
  type ParentDescriptors = {
    id: ModelId;
    children?: TargetRelationship<Child, Relations.ManyToMany>;
    name?: string;
  };

  type ChildDescriptors = {
    id: ModelId;
    name: string;
    parent?: SourceRelationship<typeof Parent, Relations.ManyToMany>;
  };
  class Parent extends Model<typeof Parent, ParentDescriptors> implements ParentDescriptors {
    static modelName = "Parent" as const;
    static fields = {
      id: attr(),
      name: attr(),
      children: many("Child", "parent"),
    };

    id: ModelId;
    children?: TargetRelationship<Child, Relations.ManyToMany>;
    name?: string;
  }

  class Child extends Model<typeof Child, ChildDescriptors> implements ChildDescriptors {
    static modelName = "Child" as const;

    id: ModelId;
    name: string;
    parent?: SourceRelationship<typeof Parent, Relations.ManyToMany>;
  }


  type Schema = {
    Child: typeof Child;
    Parent: typeof Parent;
  }

  let orm: ORM<Schema>;
  let session: SessionWithBoundModels<Schema>;

  beforeEach(() => {
    orm = new ORM<Schema>();
    orm.register(Parent, Child);
    session = orm.session(orm.getEmptyState());
  });

  const createChildren = (start: number, end: number) => {
    for (let i = start; i < end; ++i) {
      session.Child.create({
        id: i,
        name: randomName(),
      });
    }
  };

  const assignChildren = (
    parent: SessionBoundModel<Parent>,
    start: number,
    end: number
  ) => {
    for (let i = start; i < end; ++i) {
      parent.children?.add(i);
    }
  };

  it("adds many-to-many relationships in acceptable time", () => {
    const { Parent } = session;

    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    let parent: SessionBoundModel<Parent>;
    const n = 5;
    const childAmount = 1000;
    createChildren(0, 8000);

    const measurements = nTimes(n)
      .map((_value, index) => {
        parent = Parent.create({
          id: index,
        });
        return measureMs(() => {
          assignChildren(parent, 0, childAmount);
        });
      })
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    print(createTimeLog(
      `Adding ${childAmount} m2n relationships`,
      tookSeconds,
      maxSeconds,
      measurements
    ));
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("queries many-to-many relationships in acceptable time", () => {
    const { Parent } = session;

    const maxSeconds = process.env.TRAVIS ? 15 : 2;
    const n = 5;
    const queryCount = 500;
    const parent = Parent.create({ id: 1 });
    createChildren(0, 10000);
    assignChildren(parent, 0, 3000);

    const measurements = nTimes(n)
      .map(() =>
        measureMs(() => {
          for (let i = 0; i < queryCount; ++i) {
            parent.children?.count();
          }
        })
      )
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    print(createTimeLog(
      `Performing ${queryCount} m2n relationship queries`,
      tookSeconds,
      maxSeconds,
      measurements
    ));
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("removes many-to-many relationships in acceptable time", () => {
    const { Parent } = session;

    const maxSeconds = process.env.TRAVIS ? 7.5 : 2;
    const n = 5;
    const removeCount = 500;

    const parent = Parent.create({ id: 1 });
    createChildren(0, removeCount * n);
    assignChildren(parent, 0, removeCount * n);

    const measurements = nTimes(n)
      .map((_value, index) => {
        const start = removeCount * index;
        const end = removeCount + start;
        const ms = measureMs(() => {
          for (let i = start; i < end; ++i) {
            parent.children?.remove(i);
          }
        });
        /**
         * reassign children to parent (undo the above code)
         * otherwise the removal will speed up the removal of further children
         */
        assignChildren(parent, start, end);
        return ms;
      })
      .map((ms: number) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    print(createTimeLog(
      `Removing ${removeCount} m2n relationships`,
      tookSeconds,
      maxSeconds,
      measurements
    ));
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });
});

describe("Benchmark", () => {
  const logs: string[] = [];
  type LocationDescriptors = {
    id: string;
    name: string;
    employees: QuerySet;
  };
  type EmployeeDescriptors = {
    id: string;
    name: string;
    resource: SessionBoundModel;
    location: QuerySet;
  };
  type ResourceDescriptors = {
    id: string;
    name: string;
    employees: QuerySet;
  };

  type CustomSession = {
    Location: typeof Model;
    Employee: typeof Model;
    Resource: typeof Model;
  }
  let models: typeof AnyModel[] = [];

  const createModelsList = (amount: number) => {
    const models: (typeof AnyModel)[] = [];

    for (let i = 0; i < amount; i++) {
      const randomizedName = randomName();
      class Test extends Model {
        static modelName = randomizedName;

        @Attribute
        public id: string;

        @Attribute
        public name: string;

        @OneToOne('Location', randomizedName)
        public location: SessionBoundModel;

        @ManyToMany('Employee', randomizedName)
        public employees: QuerySet;

        @ForeignKey('Resource', randomizedName)
        public resource: SessionBoundModel;
      }

      models.push(Test);
    }

    return models;
  }

  const getTestModels = () => {
    class Location extends Model implements LocationDescriptors {
      static modelName = "Location";

      @Attribute
      public id: string;

      @Attribute
      public name: string;

      @ManyToMany('Employee', 'locations')
      public employees: QuerySet;
    }
    class Employee extends Model implements EmployeeDescriptors {
      static modelName = "Employee";

      @Attribute
      public id: string;

      @Attribute
      public name: string;

      @ForeignKey('Resource', 'employees')
      public resource: SessionBoundModel;

      public location: QuerySet;
    }
    class Resource extends Model implements ResourceDescriptors {
      static modelName = "Resource";

      @Attribute
      public id: string;

      @Attribute
      public name: string;

      public employees: QuerySet;
    }

    return {
      Location,
      Employee,
      Resource
    }
  }

  const setupSession = (models: typeof AnyModel[]) => {
    const orm = new ORM();
    orm.register(...models);
    const session = castTo<CustomSession>(orm.session(orm.getEmptyState()));

    return { session };
  }

  const createEntities = (model: typeof Model, amount: number) => {
    for (let i = 0; i < amount; ++i) {
      model.create({
        id: i,
        name: randomName(),
      });
    }
  }

  const assignEntities1ToN = (session: CustomSession, from: keyof CustomSession, to: keyof CustomSession, descriptorName: string) => {
    const {[from]: SourceModel, [to]: TargetModel} = session;
    const sourceCount = SourceModel.count();
    const targetCount = TargetModel.count();

    if (sourceCount === 0 || targetCount === 0) {
      throw Error('Entities are not created');
    }
    const sourceModels = SourceModel.all().toModelArray();
    let sourceIdx = 0;
    let targetIdx = 0;

    while (sourceIdx < sourceCount) {
      if (targetIdx >= targetCount) {
        targetIdx = 0;
      }
      sourceModels[sourceIdx].update({ [descriptorName]: targetIdx })
      targetIdx += 1;
      sourceIdx += 1;
    }
  };

  const assignEntitiesNtoM = (session: CustomSession, from: keyof CustomSession, to: keyof CustomSession, descriptorName: string) => {
    const {[from]: SourceModel, [to]: TargetModel} = session;
    const sourceCount = SourceModel.count();
    const targetCount = TargetModel.count();

    if (sourceCount === 0 || targetCount === 0) {
      throw Error('Entities are not created');
    }

    const sourceModels = SourceModel.all().toModelArray();
    const targetModelsIds = TargetModel.all().toModelArray().map(model => (model as any).id as number);

    sourceModels.forEach(model => {
      model.update({ [descriptorName]: targetModelsIds })
    })
  };

  const createDb = (session: CustomSession) => {
    createEntities(session.Location, 400);
    createEntities(session.Employee, 200);
    createEntities(session.Resource, 100);

    assignEntitiesNtoM(session, 'Location', 'Employee', 'employees');
    assignEntities1ToN(session, 'Employee', 'Resource', 'resource');
  }

  beforeEach(() => {
    const registry = ModelDescriptorsRegistry.getInstance();
    registry.clear();
    models = Object.values(getTestModels());
  })

  afterAll(() => {
    print(logs.join('\n'));
  })

  it("registering many models", () => {
    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    const n = 10;
    const repsNumber = 500;

    const measurements = nTimes(n)
      .map(() => {
        const registry = ModelDescriptorsRegistry.getInstance();
        registry.clear();

        return measureMs(() => {
          setupSession([...Object.values(getTestModels()), ...createModelsList(repsNumber)]);
        });
      })
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    const log = createTimeLog(
      `Creating and registering ${repsNumber} models`,
      tookSeconds,
      maxSeconds,
      measurements
    );
    logs.push(log);
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("creating many entities", () => {
    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    const n = 10;
    const repsNumber = 8000;
    const { session } = setupSession(models);

    const measurements = nTimes(n)
      .map(() => measureMs(() => {
        createEntities(session.Resource, repsNumber)
      }))
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    const log = createTimeLog(
      `Creating ${repsNumber} entities of Resource type`,
      tookSeconds,
      maxSeconds,
      measurements
    );
    logs.push(log);
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("accessing a single property", () => {
    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    const n = 10;
    const repsNumber = 800;
    const { session } = setupSession(models);
    createDb(session);

    const measurements = nTimes(n)
      .map(() => measureMs(() => {
        for (let i = 0; i < repsNumber; ++i) {
          (session.Location.first() as any).name
        }
      }))
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    const log = createTimeLog(
      `Accessing a single property ${repsNumber} times`,
      tookSeconds,
      maxSeconds,
      measurements
    );
    logs.push(log);
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("accessing a model using 1-N forwards relation key", () => {
    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    const n = 10;
    const repsNumber = 800;
    const { session } = setupSession(models);
    createDb(session);

    const measurements = nTimes(n)
      .map(() => measureMs(() => {
        for (let i = 0; i < repsNumber; ++i) {
          (session.Employee.first() as any).resource
        }
      }))
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    const log = createTimeLog(
      `Accessing a model using 1-N forwards relation key ${repsNumber} times`,
      tookSeconds,
      maxSeconds,
      measurements
    );
    logs.push(log);
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("accessing a model using N-1 backwards relation key", () => {
    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    const n = 10;
    const repsNumber = 800;
    const { session } = setupSession(models);
    createDb(session);

    const measurements = nTimes(n)
      .map(() => measureMs(() => {
        for (let i = 0; i < repsNumber; ++i) {
          (session.Resource.first() as any).employees.first()
        }
      }))
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    const log = createTimeLog(
      `Accessing a model using N-1 backwards relation key ${repsNumber} times`,
      tookSeconds,
      maxSeconds,
      measurements
    );
    logs.push(log);
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("accessing a model using N-M forwards relation key", () => {
    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    const n = 10;
    const repsNumber = 200;
    const { session } = setupSession(models);
    createDb(session);

    const measurements = nTimes(n)
      .map(() => measureMs(() => {
        for (let i = 0; i < repsNumber; ++i) {
          (session.Location.first() as any).employees.first()
        }
      }))
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    const log = createTimeLog(
      `Accessing a model using N-M forwards relation key ${repsNumber} times`,
      tookSeconds,
      maxSeconds,
      measurements
    );
    logs.push(log);
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("accessing a model using M-N backwards relation key", () => {
    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    const n = 10;
    const repsNumber = 200;
    const { session } = setupSession(models);
    createDb(session);

    const measurements = nTimes(n)
      .map(() => measureMs(() => {
        for (let i = 0; i < repsNumber; ++i) {
          (session.Employee.first() as any).locations.first()
        }
      }))
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    const log = createTimeLog(
      `Accessing a model using M-N backwards relation key ${repsNumber} times`,
      tookSeconds,
      maxSeconds,
      measurements
    );
    logs.push(log);
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("accessing a single property using relations chain", () => {
    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    const n = 10;
    const repsNumber = 200;
    const { session } = setupSession(models);
    createDb(session);

    const measurements = nTimes(n)
      .map(() => measureMs(() => {
        for (let i = 0; i < repsNumber; ++i) {
          (session.Location.first() as any).employees.first().resource.name
        }
      }))
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    const log = createTimeLog(
      `Accessing a single property using relations chain ${repsNumber} times`,
      tookSeconds,
      maxSeconds,
      measurements
    );
    logs.push(log);
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });
})
