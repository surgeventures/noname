import { Model, ORM, attr, many } from "../..";
import { ModelDescriptorsRegistry, registerDescriptors } from '../../Model';
import { ModelId, Relations, SessionBoundModel, SessionWithBoundModels, TargetRelationship, SourceRelationship } from "../../types";
import { measureMs, nTimes, avg, round } from "../helpers";

const registry = ModelDescriptorsRegistry.getInstance();
registry.clear()

const crypto = require("crypto");

const PRECISION = 2;
const logTime = (
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
  // eslint-disable-next-line no-console
  console.log(out);
};

const randomName = (): string => crypto.randomBytes(16).toString("hex");

describe("Big Data Test", () => {
  type ExtendedSession = {
    Item: typeof Model;
  };

  let orm: ORM;
  let session: ExtendedSession;

  beforeEach(() => {
    class Item extends Model {
      static modelName = "Item";
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
    orm.register(Item);
    session = orm.session(orm.getEmptyState());
  });

  it("adds a big amount of items in acceptable time", () => {
    const { Item } = session;

    const maxSeconds = process.env.TRAVIS ? 10 : 2;
    const n = 5;
    const amount = 50000;
    const items = new Map(
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
            Item.create(items.get(i)!);
          }
        });
      })
      .map((ms) => ms / 1000);

    const tookSeconds = round(avg(measurements, n), PRECISION);
    logTime(
      `Creating ${amount} objects`,
      tookSeconds,
      maxSeconds,
      measurements
    );
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });

  it("looks up items by id in a large table in acceptable time", () => {
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
    logTime(
      `Looking up ${lookupCount} objects by id`,
      tookSeconds,
      maxSeconds,
      measurements
    );
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
    logTime(
      `Adding ${childAmount} m2n relationships`,
      tookSeconds,
      maxSeconds,
      measurements
    );
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
    logTime(
      `Performing ${queryCount} m2n relationship queries`,
      tookSeconds,
      maxSeconds,
      measurements
    );
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
    logTime(
      `Removing ${removeCount} m2n relationships`,
      tookSeconds,
      maxSeconds,
      measurements
    );
    expect(tookSeconds).toBeLessThanOrEqual(maxSeconds);
  });
});
