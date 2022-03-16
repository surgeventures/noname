declare module "immutable-ops" {
  export type BatchToken = any;

  export type SetFunc = {
    (key?: string, value?: any, obj?: object): any;
  };

  export type BatchOps = {
    filter: (
      ownerId: BatchToken,
      cb: (value: any) => boolean,
      coll: any[]
    ) => any[];
    push: (ownerID: BatchToken, vals: any | any[], arr: any[]) => any[];
    set: (
      ownerID: BatchToken,
      key?: string,
      value?: any,
      obj?: object
    ) => object;
    setIn: (
      ownerID: BatchToken,
      path: string | string[],
      value: any,
      obj: object
    ) => object;
    merge: (ownerID: BatchToken, obj1?: any, obj2?: any) => any;
    omit: (ownerID: BatchToken, keys: string | string[], obj: object) => object;
  };

  export type MutableOps = {
    push: (vals: any | any[], arr: any[]) => any[];
    set: (key: string, value: any, obj: object) => object;
    setIn: (path: string | string[], value: any, obj: object) => object;
    merge: (obj1: any, obj2: any) => any;
    splice: (
      startIndex: number,
      deleteCount: number,
      values: any[],
      targetArray: any[]
    ) => any[];
    omit: (keys: string | string[], obj: object) => object;
  };

  export const getBatchToken: () => BatchToken;

  export const batch: BatchOps;
  export const mutable: MutableOps;
}

declare module "lodash/filter" {
  function filter(
    coll: { [k: string]: any },
    pred: (value: any, key: string, coll: { [k: string]: any }) => boolean
  ): any[];
  function filter(
    coll: any[],
    pred: (value: any, index: number, coll: any[]) => boolean
  ): any[];
  function filter(
    coll: { [k: string]: any },
    pred: object
  ): { [k: string]: any };
  function filter<T = any>(coll: T[], pred: object): T[];

  export default filter;
}

declare module "lodash/reject" {
  function reject(
    coll: { [k: string]: any },
    pred: (value: any, key: string, coll: { [k: string]: any }) => boolean
  ): any[];
  function reject(
    coll: any[],
    pred: (value: any, index: number, coll: any[]) => boolean
  ): any[];
  function reject(
    coll: { [k: string]: any },
    pred: object
  ): { [k: string]: any };
  function reject<T = any>(coll: T[], pred: object): T[];

  export default reject;
}

declare module "lodash/orderBy" {
  function orderBy(
    coll: { [k: string]: any },
    iteratees?: string[],
    orders?: string[]
  ): any[];
  function orderBy<T = any>(coll: T[], iteratees?: string[], orders?: string[]): T[];

  export default orderBy;
}

declare module "lodash/isNaN" {
  function isNaN(value?: any): boolean;

  export default isNaN;
}

declare module "lodash/sortBy" {
  export type SortByPredicate<T> = {
    (arg: T): number;
  };

  function sortBy(coll: { [k: string]: any }, iteratees?: any[]): any[];
  function sortBy<T extends any = any>(
    coll: T[],
    iteratees?: SortByPredicate<T>
  ): T[];

  export default sortBy;
}

declare module "lodash/mapValues" {
  function mapValues(arg: object, cb: (x: any) => any): object;

  export default mapValues;
}

declare module "deep-freeze" {
  export default function (obj: any): any;
}
