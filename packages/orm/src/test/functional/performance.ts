import { Model, ORM, attr, many, QuerySet } from "../..";
import { AnyModel, ModelDescriptorsRegistry, registerDescriptors, SessionBoundModel } from '../../Model';
import { ModelId, Relations, SessionBoundModel, SessionWithBoundModels, TargetRelationship, SourceRelationship } from "../../types";
import { createSelector } from "../..";
import { createSelector as createReselectSelector } from "reselect";
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
const randomInt = (max: number): number => {
  return Math.floor(Math.random() * max);
}

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

describe.only("Selectors performance", () => {
  let models: any[] = [];
  const logs: string[] = [];
  type OrmSelector<R> = (orm: ORM, selector: (session: CustomSession) => R) => R;

  const getTestModels = () => {
    class Room extends Model {
      static modelName = 'Room';

      @Attribute
      id: string;

      @Attribute
      name: string;

      @ForeignKey('Location', 'rooms')
      location: any;

      @ManyToMany('Service', 'rooms')
      services: any;
    }

    class Service extends Model {
      static modelName = 'Service';

      @Attribute
      id: string;

      @Attribute
      name: string;

      @Attribute
      extraTimeInSeconds: string;

      @Attribute
      extraTimeType: string;

      @Attribute
      roomRequired: string;

      @Attribute
      deletedAt: string;

      @Attribute
      voucherEnabled: string;

      @Attribute
      sortingId: any;

      @Attribute
      onlineBookingEnabled: any;

      @Attribute
      commissionEnabled: any;

      @Attribute
      description: any;

      @Attribute
      gender: any;

      @Attribute
      voucherExpirationPeriod: any;
    }

    class ServicePricingLevel extends Model {
      static modelName = 'ServicePricingLevel';

      @Attribute
      id: any;

      @Attribute
      duration: any;

      @Attribute
      name: any;

      @Attribute
      price: any;

      @Attribute
      deletedAt: any;

      @Attribute
      specialPrice: any;

      @Attribute
      priceType: any;

      @ForeignKey('Service', 'pricingLevels')
      service: any;

      toObject(): ServicePricingLevelProps {
        const { service = {} } = this as any;
        const { rooms, employees } = service;
        const serviceRef = service.ref;

        return {
          ...serviceRef,
          ...this.ref,
          service: serviceRef,
          serviceName: serviceRef.name,
          serviceId: serviceRef.id,

          rooms: rooms && rooms.toRefArray(),
          employees: employees && employees.toRefArray(),
        };
      }
    }
    class Employee extends Model {
      static modelName = 'Employee';

      @Attribute
      id: any;

      @Attribute
      name: any;

      @Attribute
      firstName: any;

      @Attribute
      lastName: any;

      @Attribute
      providesServices: any;

      @Attribute
      role: any;

      @Attribute
      services: any

      @Attribute
      appointmentColor: any

      @Attribute
      title: any

      @Attribute
      calendarTipsReadAt: any

      @Attribute
      confirmedAt: any
    }

    class LocationAddress extends Model {
      static modelName = 'LocationAddress';

      @Attribute
      id: any;
    }

    class NewBusinessType extends Model {
      static modelName = 'NewBusinessType';

      @Attribute
      id: any;

      @Attribute
      englishName: any;

      @Attribute
      name: any;

      @Attribute
      pluralName: any;

      @Attribute
      sortingId: any;
    }

    class Location extends Model {
      static modelName = 'Location';

      @Attribute
      id: any;

      @Attribute
      deletedAt: any;

      @Attribute
      displayNewAddress: any;

      @Attribute
      name: any;

      @Attribute
      sortingId: any;

      @Attribute
      services: any

      @OneToOne('LocationAddress', 'location')
      address: any;

      @ManyToMany('Employee', 'locations')
      employees: any;

      @ManyToMany('NewBusinessType', 'locationSecondaryBusinessTypes')
      secondaryBusinessTypes: any;

      @ForeignKey('NewBusinessType', 'locationPrimaryBusinessType')
      primaryBusinessType: any;

      toObject(): any {
        return {
          ...this.ref,
          rooms: (this as any).rooms.toRefArray(),
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

  type RoomProps = {
    id: string;
    name: string;
  }
  type ServiceProps = {
    id: string;
    roomRequired: boolean;
  }
  type ServicePricingLevelProps = {
    id: string;
    service: ReturnType<typeof getTestModels>['Service'] & ServiceProps;
    rooms: { id: string }[];
  }
  type LocationProps = {
    id: string;
    deletedAt: null | string;
    isOnline: boolean;
    displayNewAddress: boolean;
    name: string;
    sortingId: number;
    services: string[];
    rooms: { id: string; name: string }[];
  };
  type EmployeeProps = {
    id: string;
    appointmentColor: string;
    calendarTipsReadAt: string | null;
    confirmedAt: string | null;
    deletedAt: string | null;
    email: string;
    employmentEndDate: string | null;
    employmentStartDate: string;
    firstName: string;
    lastName: string;
    mobileNumber: null | string;
    name: string;
    notes: string | null;
    providesServices: boolean;
    sortingId: number;
    title: string | null;
    paidPlanCommission: null | number;
    productCommission: null | number;
    serviceCommission: null | number;
    voucherCommission: null | number;
    services: string[];
  };
  type LocationAddressProps = {
    id: string;
  };
  type NewBusinessTypeProps = {
    id: string;
    englishName: string;
    name: string;
    pluralName: string;
    sortingId: number;
  };

  type CustomSession = {
    Room: typeof Model & RoomProps;
    Service: typeof Model & ServiceProps;
    ServicePricingLevel: typeof Model & ServicePricingLevelProps;
    Location: typeof Model & LocationProps;
    Employee: typeof Model & EmployeeProps;
    LocationAddress: typeof Model & LocationAddressProps;
    NewBusinessType: typeof Model & NewBusinessTypeProps;
  };

  const createSelectors = (orm: ORM) =>
  {
    const selectLocations = (session: CustomSession, { withDeleted = false, withOffline = true } = {}) => {
      let collection = session.Location.filter((location: CustomSession['Location']) => {
        // Filter out incomplete resources that were created with json relationships
        // { id: 1, type: 'Location'} is an incomplete resource
        return Number.isFinite(location.sortingId);
      })
        .orderBy(['sortingId'])
        .toModelArray()
        .map((location) => (location as InstanceType<ReturnType<typeof getTestModels>['Location']>).toObject());

        if (!withDeleted) {
          collection = collection.filter(location => !location.deletedAt);
        }

        if (!withOffline) {
          collection = collection.filter(location => location.isOnline);
        }

      return collection;
    };

    const getServicePricingLevelList: OrmSelector<ServicePricingLevelProps[]> = createSelector(orm, (session: CustomSession) =>
      session.ServicePricingLevel.all()
        .toModelArray()
        // if there is only one key (id) it means that booking was created by relation.
        // In that case it cannot be displayed on calendar
        .filter(spl => Object.keys(spl.ref).length > 1)
        .map(spl => (spl as InstanceType<ReturnType<typeof getTestModels>['ServicePricingLevel']>).toObject()),
    );

    const getLocationRoomDict = createSelector(orm, (session: CustomSession) =>
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

  const createEntities = (model: typeof Model, props: any, amount: number) => {
    for (let i = 0; i < amount; ++i) {
      model.create({ id: i, ...props });
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

  const assignEntitiesNtoM = (session: CustomSession, from: keyof CustomSession, to: keyof CustomSession, propertyDescriptorName: string) => {
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

  const assignEntities1to1 = (session: CustomSession, from: keyof CustomSession, to: keyof CustomSession, propertyDescriptorName: string) => {
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

  const setupSession = (models: typeof Model[]) => {
    const orm = new ORM();
    orm.register(...models);
    const session = castTo<CustomSession>(orm.session(orm.getEmptyState()));

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
          selector((session as any).state, { locationId: String(i) })
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