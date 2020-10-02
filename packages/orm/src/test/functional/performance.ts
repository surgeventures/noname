import { Model, ORM, attr, many } from "../..";
import {
  measureMs,
  nTimes,
  avg,
  round,
  IManyQuerySet,
} from "../helpers";

const crypto = require("crypto");

const PRECISION = 2;
const logTime = (message: string, tookSeconds: number, maxSeconds: number, measurements: number[]) => {
  let out = `${message} took ${tookSeconds}s / ${maxSeconds}s`;
  if (measurements) {
    const measurementSeconds = measurements
      .map((m) => round(m, PRECISION))
      .map((m) => `${m}s`)
      .join(", ");
    out += ` on average (${measurementSeconds} each)`;
  }
  console.log(out);
};

const randomName = () => crypto.randomBytes(16).toString("hex");

describe("Big Data Test", () => {
  type ExtendedSession = {
    Item: typeof Model;
  };

  let orm: ORM;
  let session: ExtendedSession;

  beforeEach(() => {
    class Item extends Model {
      static modelName = "Item";
      static fields = {
        id: attr(),
        name: attr(),
      }
    };

    orm = new ORM();
    orm.register(Item);
    session = orm.session(orm.getEmptyState()) as unknown as ExtendedSession;
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
  type ParentProps = {
    children: IManyQuerySet<typeof Model & ChildProps>;
  };

  type ChildProps = {
    parent: typeof Model & ParentProps;
  };

  type CustomSession = {
    Parent: typeof Model & ParentProps;
    Child: typeof Model & ChildProps;
  };

  let orm;
  let session: CustomSession;

  beforeEach(() => {
    class Parent extends Model {
      static modelName = "Parent";
      static fields = {
        id: attr(),
        name: attr(),
        children: many("Child", "parent"),
      };
    };

    class Child extends Model {
      static modelName = "Child";
    };

    orm = new ORM();
    orm.register(Parent, Child);
    session = orm.session(orm.getEmptyState()) as unknown as CustomSession;
  });

  const createChildren = (start: number, end: number) => {
    for (let i = start; i < end; ++i) {
      session.Child.create({
        id: i,
        name: randomName(),
      });
    }
  };

  const assignChildren = (parent: Model & ParentProps, start: number, end: number) => {
    for (let i = start; i < end; ++i) {
      parent.children.add(i);
    }
  };

  it("adds many-to-many relationships in acceptable time", () => {
    const { Parent } = session;

    const maxSeconds = process.env.TRAVIS ? 13.5 : 1;
    let parent: Model & ParentProps;
    const n = 5;
    const childAmount = 1000;
    createChildren(0, 8000);

    const measurements = nTimes(n)
      .map((_value, index) => {
        parent = Parent.create({
          id: index,
        }) as unknown as (Model & ParentProps);
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
    assignChildren(parent as unknown as (Model & ParentProps), 0, 3000);

    const measurements = nTimes(n)
      .map((_value, _index) =>
        measureMs(() => {
          for (let i = 0; i < queryCount; ++i) {
            (parent as unknown as ParentProps).children.count();
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
    assignChildren(parent as unknown as (Model & ParentProps), 0, removeCount * n);

    const measurements = nTimes(n)
      .map((_value, index) => {
        const start = removeCount * index;
        const end = removeCount + start;
        const ms = measureMs(() => {
          for (let i = start; i < end; ++i) {
            (parent as unknown as ParentProps).children.remove(i);
          }
        });
        /**
         * reassign children to parent (undo the above code)
         * otherwise the removal will speed up the removal of further children
         */
        assignChildren(parent as unknown as (Model & ParentProps), start, end);
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
