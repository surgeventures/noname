import { Model, ORM, QuerySet } from "../..";
import { AnyModel } from '../../Model';
import { ModelId, Relations, SessionBoundModel, SessionWithBoundModels, TargetRelationship, SourceRelationship } from "../../types";
import { createSelector } from "../..";
import { createSelector as createReselectSelector } from "reselect";
import { measureMs, nTimes, avg, round } from "../helpers";
import { Attribute, ManyToMany, ForeignKey, OneToOne } from "../../decorators";
import { ModelDescriptorsRegistry } from "../../modelDescriptorsRegistry";

const crypto = require("crypto");

const PRECISION = 2;
// eslint-disable-next-line no-console
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
const randomInt = (max: number): number => {
  return Math.floor(Math.random() * max);
}

describe("Big Data Test", () => {
  const createModel = () => {
    type ItemDescriptors = {
      id: ModelId;
      name: string;
    }
    class Item extends Model<typeof Item, ItemDescriptors> implements ItemDescriptors {
      static modelName = "Location" as const;

      @Attribute()
      public id: ModelId;

      @Attribute()
      public name: string;
    }

    return { Item };
  }

  type Schema = {
    Item: ReturnType<typeof createModel>['Item'];
  }
  type ExtendedSession = SessionWithBoundModels<Schema>;

  let orm: ORM<Schema>;
  let session: ExtendedSession;

  beforeEach(() => {
    const { Item } = createModel();
    orm = new ORM<Schema>();
    orm.register(Item);
    session = orm.session(orm.getEmptyState());
  });

  it("adds a big amount of Items in acceptable time", () => {
    const { Item } = session;

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
            Item.create(Locations.get(i)!);
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
    const { Item } = session;

    const maxSeconds = process.env.TRAVIS ? 5 : 2;
    const n = 5;
    const lookupCount = 50000;
    const rowCount = n * lookupCount;

    for (let i = 0; i < rowCount; ++i) {
      Item.create({
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
            Item.withId(i);
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
  const createModels = () => {
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
  
      @Attribute()
      public id: ModelId;
  
      @Attribute()
      public name?: string;
  
      @ManyToMany<Parent>("Child", "parent")
      public children?: TargetRelationship<Child, Relations.ManyToMany>;
    }
  
    class Child extends Model<typeof Child, ChildDescriptors> implements ChildDescriptors {
      static modelName = "Child" as const;
  
      @Attribute()
      public id: ModelId;
  
      @Attribute()
      public name: string;
  
      public parent?: SourceRelationship<typeof Parent, Relations.ManyToMany>;
    }

    return { Child, Parent };
  }


  type Schema = {
    Child: ReturnType<typeof createModels>['Child'];
    Parent: ReturnType<typeof createModels>['Parent'];
  }

  let orm: ORM<Schema>;
  let session: SessionWithBoundModels<Schema>;

  beforeEach(() => {
    const { Child, Parent } = createModels();
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
    parent: SessionBoundModel<InstanceType<Schema['Parent']>>,
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
    let parent: SessionBoundModel<InstanceType<Schema['Parent']>>;
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

describe("Accessors and models registration performance", () => {
  const logs: string[] = [];
  
  type Schema = {
    Location: ReturnType<typeof getTestModels>['Location'];
    Employee: ReturnType<typeof getTestModels>['Employee'];
    Resource: ReturnType<typeof getTestModels>['Resource'];
  }
  let models: Schema[keyof Schema][] = [];
  
  const createModelsList = (amount: number) => {
    const models: (typeof AnyModel)[] = [];
    
    for (let i = 0; i < amount; i++) {
      const randomizedName = randomName();
      class Test extends Model {
        static modelName = randomizedName;
        
        @Attribute()
        public id: string;
        
        @Attribute()
        public name: string;
        
        @OneToOne<Test>('Location', randomizedName)
        public location: SessionBoundModel;
        
        @ManyToMany<Test>('Employee', randomizedName)
        public employees: QuerySet;
        
        @ForeignKey<Test>('Resource', randomizedName)
        public resource: SessionBoundModel;
      }
      
      models.push(Test);
    }
    
    return models;
  }
  
  const getTestModels = () => {
    type LocationDescriptors = {
      id: string;
      name: string;
      employees: TargetRelationship<Employee, Relations.ManyToMany>;
    };
    type EmployeeDescriptors = {
      id: string;
      name: string;
      resource: TargetRelationship<Resource, Relations.ForeignKey>;
      locations: SourceRelationship<typeof Location, Relations.ManyToMany>;
    };
    type ResourceDescriptors = {
      id: string;
      name: string;
      employees: SourceRelationship<typeof Employee, Relations.ForeignKey>;
    };
    class Location extends Model<typeof Location, LocationDescriptors> implements LocationDescriptors {
      static modelName = "Location" as const;

      @Attribute()
      public id: string;

      @Attribute()
      public name: string;

      @ManyToMany<Location>('Employee', 'locations')
      public employees: TargetRelationship<Employee, Relations.ManyToMany>;
    }
    class Employee extends Model<typeof Employee, EmployeeDescriptors> implements EmployeeDescriptors {
      static modelName = "Employee" as const;

      @Attribute()
      public id: string;

      @Attribute()
      public name: string;

      @ForeignKey<Employee>('Resource', 'employees')
      public resource: TargetRelationship<Resource, Relations.ForeignKey>;

      public locations: SourceRelationship<typeof Location, Relations.ManyToMany>;
    }
    class Resource extends Model<typeof Resource, ResourceDescriptors> implements ResourceDescriptors {
      static modelName = "Resource" as const;

      @Attribute()
      public id: string;

      @Attribute()
      public name: string;

      public employees: SourceRelationship<typeof Employee, Relations.ForeignKey>;
    }

    return {
      Location,
      Employee,
      Resource
    }
  }

  const setupSession = (models: (typeof AnyModel)[]) => {
    const orm = new ORM();
    orm.register(...models);
    const session = orm.session(orm.getEmptyState()) as unknown as SessionWithBoundModels<Schema>;

    return { session };
  }

  const createEntities = (model: typeof AnyModel, amount: number) => {
    for (let i = 0; i < amount; ++i) {
      model.create({
        id: i,
        name: randomName(),
      });
    }
  }

  const assignEntities1ToN = (session: Schema, from: keyof Schema, to: keyof Schema, descriptorName: string) => {
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

  const assignEntitiesNtoM = (session: Schema, from: keyof Schema, to: keyof Schema, descriptorName: string) => {
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

  const createDb = (session: Schema) => {
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
          session.Location.first()?.name
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
          session.Employee.first()?.resource
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
          session.Resource.first()?.employees.first()
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
          session.Location.first()?.employees.first()
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
          session.Employee.first()?.locations.first()
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
          session.Location.first()?.employees.first()?.resource.name
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

describe("Selectors performance", () => {
  let models: Schema[keyof Schema][] = [];
  const logs: string[] = [];

  const getTestModels = () => {
    type RoomProps = {
      id: string;
      name: string;
      location: TargetRelationship<Location, Relations.ForeignKey>;
      services: TargetRelationship<Service, Relations.ManyToMany>;
    }
    type ServiceProps = {
      id: string;
      roomRequired: boolean;
      name: string;
      extraTimeInSeconds: string;
      extraTimeType: string;
      rooms: SourceRelationship<typeof Room, Relations.ManyToMany>;
      pricingLevels: SourceRelationship<typeof ServicePricingLevel, Relations.ForeignKey>;
    }
    type ServicePricingLevelProps = {
      id: string;
      duration: string;
      name: string;
      price: string;
      deletedAt: string;
      specialPrice: string;
      priceType: string;
      service: TargetRelationship<Service, Relations.ForeignKey>;
    }
    type LocationProps = {
      id: string;
      deletedAt: string;
      isOnline: boolean;
      displayNewAddress: boolean;
      name: string;
      sortingId: number;
      services: string[];
      rooms: SourceRelationship<typeof Room, Relations.ForeignKey>;
      address: TargetRelationship<LocationAddress, Relations.OneToOne>;
      employees: TargetRelationship<Employee, Relations.ManyToMany>;
      secondaryBusinessTypes: TargetRelationship<NewBusinessType, Relations.ManyToMany>;
      primaryBusinessType: TargetRelationship<NewBusinessType, Relations.ForeignKey>;
    };
    type EmployeeProps = {
      id: string;
      appointmentColor: string;
      calendarTipsReadAt: string;
      confirmedAt: string;
      deletedAt: string;
      email: string;
      locations: SourceRelationship<typeof Location, Relations.ManyToMany>;
    };
    type LocationAddressProps = {
      id: string;
      location: SourceRelationship<typeof Location, Relations.OneToOne>;
    };
    type NewBusinessTypeProps = {
      id: string;
      englishName: string;
      name: string;
      pluralName: string;
      sortingId: number;
      locationSecondaryBusinessTypes: SourceRelationship<typeof Location, Relations.ManyToMany>;
      locationPrimaryBusinessType: SourceRelationship<typeof Location, Relations.ForeignKey>;
    };

    class Room extends Model<typeof Room, RoomProps> implements RoomProps {
      static modelName = 'Room' as const;

      @Attribute()
      public id: string;

      @Attribute()
      public name: string;

      @ForeignKey<Room>('Location', 'rooms')
      public location: TargetRelationship<Location, Relations.ForeignKey>;

      @ManyToMany<Room>('Service', 'rooms')
      public services: TargetRelationship<Service, Relations.ManyToMany>;
    }

    class Service extends Model<typeof Service, ServiceProps> implements ServiceProps {
      static modelName = 'Service' as const;

      @Attribute()
      public id: string;

      @Attribute()
      public name: string;

      @Attribute()
      public extraTimeInSeconds: string;

      @Attribute()
      public extraTimeType: string;

      @Attribute()
      public roomRequired: boolean;

      public rooms: SourceRelationship<typeof Room, Relations.ManyToMany>;
      public pricingLevels: SourceRelationship<typeof ServicePricingLevel, Relations.ForeignKey>;
    }

    class ServicePricingLevel extends Model<typeof ServicePricingLevel, ServicePricingLevelProps> implements ServicePricingLevelProps {
      static modelName = 'ServicePricingLevel' as const;

      @Attribute()
      public id: string;

      @Attribute()
      public duration: string;

      @Attribute()
      public name: string;

      @Attribute()
      public price: string;

      @Attribute()
      public deletedAt: string;

      @Attribute()
      public specialPrice: string;

      @Attribute()
      public priceType: string;

      @ForeignKey<ServicePricingLevel>('Service', 'pricingLevels')
      public service: TargetRelationship<Service, Relations.ForeignKey>;

      toObject() {
        const { service } = this;
        const { rooms } = service;
        const serviceRef = service.ref;

        return {
          ...serviceRef,
          ...this.ref as any,
          service: serviceRef,
          serviceName: serviceRef.name,
          serviceId: serviceRef.id,

          rooms: rooms && rooms.toRefArray(),
        };
      }
    }
    class Employee extends Model<typeof Employee, EmployeeProps> implements EmployeeProps {
      static modelName = 'Employee' as const;

      @Attribute()
      public id: string;

      @Attribute()
      public appointmentColor: string;

      @Attribute()
      public calendarTipsReadAt: string;

      @Attribute()
      public confirmedAt: string;

      @Attribute()
      public deletedAt: string;

      @Attribute()
      public email: string;

      public locations: SourceRelationship<typeof Location, Relations.ManyToMany>;
    }

    class LocationAddress extends Model<typeof LocationAddress, LocationAddressProps> implements LocationAddressProps {
      static modelName = 'LocationAddress' as const;

      @Attribute()
      public id: string;

      public location: SourceRelationship<typeof Location, Relations.OneToOne>;
    }

    class NewBusinessType extends Model<typeof NewBusinessType, NewBusinessTypeProps> implements NewBusinessTypeProps {
      static modelName = 'NewBusinessType' as const;

      @Attribute()
      public id: string;

      @Attribute()
      public englishName: string;

      @Attribute()
      public name: string;

      @Attribute()
      public pluralName: string;

      @Attribute()
      public sortingId: number;

      public locationSecondaryBusinessTypes: SourceRelationship<typeof Location, Relations.ManyToMany>;
      public locationPrimaryBusinessType: SourceRelationship<typeof Location, Relations.ForeignKey>;
    }

    class Location extends Model<typeof Location, LocationProps> implements LocationProps {
      static modelName = 'Location' as const;

      @Attribute()
      public id: string;

      @Attribute()
      public deletedAt: string;

      @Attribute()
      public displayNewAddress: boolean;

      @Attribute()
      public name: string;

      @Attribute()
      public sortingId: number;

      @Attribute()
      public services: string[];

      @Attribute()
      public isOnline: boolean;

      @OneToOne<Location>('LocationAddress', 'location')
      public address: TargetRelationship<LocationAddress, Relations.OneToOne>;

      @ManyToMany<Location>('Employee', 'locations')
      public employees: TargetRelationship<Employee, Relations.ManyToMany>;

      @ManyToMany<Location>('NewBusinessType', 'locationSecondaryBusinessTypes')
      public secondaryBusinessTypes: TargetRelationship<NewBusinessType, Relations.ManyToMany>;

      @ForeignKey<Location>('NewBusinessType', 'locationPrimaryBusinessType')
      public primaryBusinessType: TargetRelationship<NewBusinessType, Relations.ForeignKey>;

      public rooms: SourceRelationship<typeof Room, Relations.ForeignKey>;

      toObject() {
        return {
          ...this.ref as any,
          rooms: this.rooms.toRefArray(),
        }
      }
    }

    return {
      Room,
      Service,
      ServicePricingLevel,
      Location,
      LocationAddress,
      Employee,
      NewBusinessType,
    }
  }


  type Schema = {
    Room: ReturnType<typeof getTestModels>['Room'];
    Service: ReturnType<typeof getTestModels>['Service'];
    ServicePricingLevel: ReturnType<typeof getTestModels>['ServicePricingLevel'];
    Location: ReturnType<typeof getTestModels>['Location'];
    Employee: ReturnType<typeof getTestModels>['Employee'];
    LocationAddress: ReturnType<typeof getTestModels>['LocationAddress'];
    NewBusinessType: ReturnType<typeof getTestModels>['NewBusinessType'];
  };

  type CustomSession = SessionWithBoundModels<Schema>;

  const createSelectors = (orm: ORM<Schema>) =>
  {
    const selectLocations = (session: CustomSession, { withDeleted = false, withOffline = true } = {}) => {
      let collection = session.Location.filter(location => {
        // Filter out incomplete resources that were created with json relationships
        // { id: 1, type: 'Location'} is an incomplete resource
        return Number.isFinite(location.sortingId);
      })
        .orderBy(['sortingId'])
        .toModelArray()
        .map((location) => location.toObject());

        if (!withDeleted) {
          collection = collection.filter(location => !location.deletedAt);
        }

        if (!withOffline) {
          collection = collection.filter(location => location.isOnline);
        }

      return collection;
    };

    const getServicePricingLevelList = createSelector(orm, (session) =>
      session.ServicePricingLevel.all()
        .toModelArray()
        // if there is only one key (id) it means that booking was created by relation.
        // In that case it cannot be displayed on calendar
        .filter(spl => Object.keys(spl.ref).length > 1)
        .map(spl => spl.toObject()),
    );

    const getLocationRoomDict = createSelector(orm, (session) =>
      selectLocations(session).reduce((memo, location) => {
        memo[location.id] = location.rooms?.map(({ id, name }: { id: string; name: string }) => ({ id, name }));
        return memo;
      }, {} as Record<string, { id: string, name: string }[]>)
    );

    const getServicePricingLevelRoomDict = createReselectSelector(
      getServicePricingLevelList,
      servicePricingLevels => {
        return servicePricingLevels.reduce((memo, servicePricingLevel) => {
          if (servicePricingLevel.service.roomRequired) {
            const rooms = servicePricingLevel.rooms || [];
            memo[servicePricingLevel.id] = rooms.map(r => r.id);
          } else {
            memo[servicePricingLevel.id] = null;
          }
          return memo;
        }, {} as Record<string, string[] | null>);
      }
    );

    return createReselectSelector(
      state => (getServicePricingLevelRoomDict as any)(state),
      (state: any, { locationId }: { locationId: string }) => getLocationRoomDict(state)[locationId],
      (servicePricingLevelRooms, locationRooms) => {
        return Object.entries(servicePricingLevelRooms).reduce((memo, [splId, roomIds]) => {
          if (roomIds != null) {
            memo[splId] = locationRooms.reduce(
              (submemo: any, room: any, index: number) => {
                const available = (roomIds as string[]).includes(room.id);
                submemo.rooms.push({
                  ...room,
                  available,
                  name: available ? room.name : `⚠ ${room.name}`,
                });
                if (index === 0 || (!submemo.defaultAvailable && available)) {
                  submemo.defaultRoomId = room.id;
                  submemo.defaultAvailable = available;
                }
                return submemo;
              },
              { rooms: [], defaultRoomId: null },
            );
          }
          return memo;
        }, {} as any);
      }
    );
  }

  const createEntities = (model: typeof AnyModel, props: any, amount: number) => {
    for (let i = 0; i < amount; ++i) {
      model.create({ id: i, ...props });
    }
  }

  const assignEntities1ToN = (session: CustomSession, from: keyof Schema, to: keyof Schema, descriptorName: string) => {
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

  const assignEntitiesNtoM = (session: CustomSession, from: keyof Schema, to: keyof Schema, propertyDescriptorName: string) => {
    const {[from]: SourceModel, [to]: TargetModel} = session;
    const sourceCount = SourceModel.count();
    const targetCount = TargetModel.count();

    if (sourceCount === 0 || targetCount === 0) {
      throw Error('Entities are not created');
    }

    const sourceModels = SourceModel.all().toModelArray();
    const targetModelsIds = TargetModel.all().toModelArray().map(model => (model as any).id as number);
    sourceModels.forEach(model => {
      model.update({ [propertyDescriptorName]: targetModelsIds })
    })
  };

  const assignEntities1to1 = (session: CustomSession, from: keyof Schema, to: keyof Schema, propertyDescriptorName: string) => {
    const {[from]: SourceModel, [to]: TargetModel} = session;
    const sourceCount = SourceModel.count();
    const targetCount = TargetModel.count();

    if (sourceCount === 0 || sourceCount !== targetCount) {
      throw Error('Source and target entities count should be equal and different from 0');
    }

    const sourceModels = SourceModel.all().toModelArray();
    sourceModels.forEach((model, idx) => {
      model.update({ [propertyDescriptorName]: idx })
    })
  }

  const setupSession = (models: Schema[keyof Schema][]) => {
    const orm = new ORM<Schema>();
    orm.register(...models);
    const session = orm.session(orm.getEmptyState());

    return { session, orm };
  }

  const createDb = (session: CustomSession) => {
    createEntities(session.Room, {
      name: randomName(),
    }, 800);
    createEntities(session.Location, {
      displayNewAddress: true,
      name: randomName(),
      sortingId: randomInt(400),
      services: [randomName(), randomName(), randomName()]
    }, 400);
    createEntities(session.LocationAddress, {
      apartmentSuite: randomName(),
      cityName: randomName(),
      countryCode: randomName(),
      directions: randomName(),
      district: randomName(),
      latitude: randomName(),
      longitude: randomName(),
      postalCode: randomName(),
      providesServicesAtLocation: true,
      region1: randomName(),
      region2: randomName(),
      streetAddress: randomName(),
    }, 400);
    createEntities(session.Employee, {
      name: randomName(),
      firstName: randomName(),
      lastName: randomName(),
      providesServices: true,
      role: randomName(),
      services: [randomName(), randomName(), randomName()],
      appointmentColor: randomName(),
      title: randomName(),
      calendarTipsReadAt: randomName(),
      confirmedAt: randomName(),
    }, 200);
    createEntities(session.NewBusinessType, {
      englishName: randomName(),
      name: randomName(),
      pluralName: randomName(),
      sortingId: randomInt(200),
    }, 200);
    createEntities(session.ServicePricingLevel, {
      duration: randomName(),
      name: randomName(),
      price: randomName(),
      specialPrice: randomName(),
      priceType: randomName(),
      deletedAt: randomName(),
    }, 200);
    createEntities(session.Service, {
      name: randomName(),
      extraTimeInSeconds: randomInt(100),
      extraTimeType: randomName(),
      roomRequired: true,
      deletedAt: randomName(),
      voucherEnabled: true,
      sortingId: randomInt(100),
      onlineBookingEnabled: true,
      commissionEnabled: true,
      description: randomName(),
      gender: randomName(),
      voucherExpirationPeriod: randomName(),
    }, 100);

    assignEntities1ToN(session, 'Room', 'Location', 'location');
    assignEntitiesNtoM(session, 'Room', 'Service', 'services');

    assignEntitiesNtoM(session, 'Location', 'Employee', 'employees');
    assignEntities1ToN(session, 'Location', 'NewBusinessType', 'primaryBusinessType');
    assignEntities1ToN(session, 'ServicePricingLevel', 'Service', 'service');
    assignEntitiesNtoM(session, 'Location', 'NewBusinessType', 'secondaryBusinessTypes');
    assignEntities1to1(session, 'Location', 'LocationAddress', 'address');
  }

  beforeEach(() => {
    models = Object.values(getTestModels());
  })

  afterAll(() => {
    print(logs.join('\n'));
  })

  it("creating many entities", () => {
    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    const n = 10;
    const repsNumber = 400;
    const { session, orm } = setupSession(models);
    createDb(session);

    const measurements = nTimes(n)
    .map(() => measureMs(() => {
      const selector = createSelectors(orm)
      for (let i = 0; i < repsNumber; ++i) {
          selector(session.state, { locationId: String(i) })
        }
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
})