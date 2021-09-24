import { BatchToken } from "immutable-ops";

import {
  CREATE,
  DELETE,
  EXCLUDE,
  FAILURE,
  FILTER,
  ORDER_BY,
  SUCCESS,
  UPDATE,
} from "./constants";
import Table from "./db/Table";
import Model, { AnyModel, ModelClassMap } from "./Model";
import Session from "./Session";
import QuerySet from "./QuerySet";
import { Field } from "./fields";

/**
 * 
 */
export type AnyObject = Record<string, unknown>;
/**
 * 
 */
export type AnySchema = Record<string, typeof AnyModel>;

/**
 * Enumerates possible relations
 */
export enum Relations {
  OneToOne = "oneToOne",
  ForeignKey = "foreignKey",
  ManyToMany = "manyToMany"
}

/**
 * Extracts the first generic argument from the derived class.
 */
export type ExtractModelClassType<T> = T extends Model<infer U> ? U : T;

/**
 * Extracts the first generic argument from the derived class.
 */
type ModelClass<M extends AnyModel> = ReturnType<M["getClass"]>;

/**
 * Extracts the first generic argument from the derived class.
 */
export type SessionBoundModel<
  M extends AnyModel = AnyModel,
  InstanceProps extends object = {}
> = Omit<M, "ref"> &
  {
    [K in keyof ModelFields<M>]: ModelFields<M>[K] extends AnyModel
      ? SessionBoundModel<ModelFields<M>[K]>
      : ModelFields<M>[K];
  } &
  InstanceProps & { ref: Ref<M> };

/**
 * 
 */
export type SessionBoundModelConstructor<M extends AnyModel> = {
  new (props: Row<M>): SessionBoundModel<M>; 
}


export type QuerySetConstructor<M extends AnyModel, Payload extends object = {}> = {
  new (modelClass: ExtractModelClassType<M>, clauses?: QueryClause<Payload>[], opts?: object): QuerySet<M>;
}

/**
 * 
 */
export type Ref<M extends AnyModel> = {
    [K in keyof ModelFields<M>]: ModelFields<M>[K] extends QuerySet
      ? never
      : ModelFields<M>[K] extends AnyModel
      ? ModelId | undefined
      : ModelFields<M>[K];
  };

/**
 * 
 */
export type TargetRelationship<
  M extends AnyModel,
  Relation extends Relations
> = Relation extends Relations.OneToOne
  ? SessionBoundModel<M>
  : Relation extends Relations.ForeignKey
  ? SessionBoundModel<M>
  : Relation extends Relations.ManyToMany
  ? QuerySet<M>
  : never;

/**
 * 
 */
export type SourceRelationship<
  M extends AnyModel,
  Relation extends Relations
> = Relation extends Relations.OneToOne
  ? SessionBoundModel<M>
  : Relation extends Relations.ForeignKey
  ? QuerySet<M>
  : Relation extends Relations.ManyToMany
  ? QuerySet<M>
  : never;

/**
 * Extracts the first generic argument from the derived class.
 */
type ModelField = QuerySet | AnyModel | Serializable;

/**
 * 
 */
type BackwardsModelField = unknown;

/**
 * Extracts the first generic argument from the derived class.
 */
export type ModelFieldMap = {
  id?: ModelId;
  [K: string]: ModelField | BackwardsModelField;
};

/**
 * 
 */
export type ModelFields<M extends AnyModel> = ConstructorParameters<
  ModelClass<M>
> extends [infer U]
  ? U
  : never;

/**
 * 
 */
export type Row<M extends AnyModel> = ModelFields<M> extends ModelAttrs<infer Fields>
  ? Fields
  : never;

/**
 * 
 */
export type ModelAttrs<Attrs extends ModelFieldMap = ModelFieldMap> = {
  [K in keyof Attrs]: Attrs[K] extends QuerySet
    ? never
    : Attrs[K] extends AnyModel
    ? ModelId | undefined
    : Attrs[K];
};

/**
 * 
 */
type IsAny<T> = (
  unknown extends T
    ? [keyof T] extends [never] ? false : true
    : false
);
/**
 * 
 */
export type OmitUnknowns<T> = {[K in keyof T]: unknown extends T[K] ? IsAny<T[K]> extends true ? T[K] : never : T[K] };

/**
 * Optional ordering direction.
 *
 * {@see QuerySet.orderBy}
 */
  export type SortOrder = 'asc' | 'desc' | true | false;

  /**
  * Ordering clause.
  *
  * Either a key of SessionBoundModel or a evaluator function accepting plain object Model representation stored in the database.
  *
  * {@see QuerySet.orderBy}
  */
  export type SortIteratee<M extends AnyModel> = keyof Ref<M> | { (row: Ref<M>): any };

/**
 * A primitive value
 */
export type Primitive = number | string | boolean;

/**
 * Serializable value: a primitive, undefined, a serializable object or an array of those
 */
export type Serializable =
  | Primitive
  | Primitive[]
  | undefined
  | {
      [K: string]: Serializable | Serializable[];
    };

/**
 * 
 */
export type TableState<MClass extends typeof AnyModel> = {
  meta: {
    maxId?: number;
    [k: string]: any;
  };
  items: ModelId[];
  itemsById: Record<ModelId, Ref<InstanceType<MClass>>>;
};

/**
 * 
 */
 export type SessionLike<Schema extends ModelClassMap> = Session<Schema> & Schema;

/**
 * 
 */
export type OrmState<Schema extends ModelClassMap> = { [K in keyof Schema]: TableState<Schema[K]> };

/**
 * A type of {@link QueryClause}.
 */
export type QueryType = typeof FILTER | typeof EXCLUDE | typeof ORDER_BY;

/**
 * A single `QueryClause`.
 * Multiple `QueryClause`s can be combined into a {@link Query}.
 */
export interface QueryClause<Payload extends object = {}> {
  type: QueryType;
  payload?: Payload;
}

/**
 * Query definition, contains target table and a collection of {@link QueryClause}.
 */
export interface Query<Schema extends ModelClassMap, Payload extends object = {}> {
  table: keyof Schema;
  clauses: QueryClause<Payload>[];
}

/**
 * Query wrapper definition, wraps {@link Query}.
 */
export interface QuerySpec<Schema extends ModelClassMap, Payload extends object = {}> {
  query: Query<Schema, Payload>;
}

/**
 * A type of data update to perform.
 */
export type UpdateType = typeof CREATE | typeof UPDATE | typeof DELETE;

/**
 * A status of data update operation.
 */
export type UpdateStatus = typeof SUCCESS | typeof FAILURE;

/**
 * Data update definition
 */
export interface UpdateSpec<Schema extends ModelClassMap, Payload extends {} = {}> {
  action: UpdateType;
  query?: Query<Schema>;
  table?: keyof Schema;
  payload?: Payload;
}

/**
 * 
 */
export type UpdateCreateSpec = {
  table: string;
};

/**
 * Data update result.
 */
export interface UpdateResult<Schema extends ModelClassMap> {
  status: UpdateStatus;
  state: OrmState<Schema>;
  payload: object;
}

/**
 * Transactions aggregate batches of operations.
 */
export interface Transaction {
  batchToken: BatchToken;
  withMutations: boolean;
}

/**
 * 
 */
export interface Database<Schema extends ModelClassMap> {
  describe(modelName: keyof Schema): Table<Schema[keyof Schema]>;
  getEmptyState(): OrmState<Schema>;
  query<M extends AnyModel, Payload extends object = {}>(query: Query<Schema, Payload>, state: OrmState<Schema>): { rows: Row<M>[] };
  update<Payload extends object = {}>(
    updateSpec: UpdateSpec<Schema>,
    tx: Transaction,
    state: OrmState<Schema>
  ): { status: UpdateStatus; state: OrmState<Schema>; payload: Payload };
}

/**
 * 
 */
export type ModelId = number | string;

/**
 * 
 */
// Try to replace with AnyObject
export type ModelData = Record<string, any>;

/**
 * {@link TableOpts} used for {@link Table} customization.
 *
 * Supplied via {@link Model#options}.
 *
 * If no customizations were provided, the table uses following default options:
 * <br/>
 * ```typescript
 *  {
 *      idAttribute: 'id',
 *  }
 * ```
 * <br/>
 *  @see {@link Model}
 *  @see {@link Model#options}
 *  @see {@link OrmState}
 */
 export interface TableOpts {
  readonly idAttribute?: string;
  readonly arrName?: string;
  readonly mapName?: string;
  readonly fields?: { [K: string]: Field };
}

/**
 * 
 */
export interface ModelTableOpts<MClassType extends typeof AnyModel> {
  readonly idAttribute?: IdAttribute<MClassType>;
  readonly arrName?: ArrName<MClassType>;
  readonly mapName?: MapName<MClassType>;
  readonly fields?: MClassType['fields'];
}

/**
 * 
 */
type IdAttribute<MClassType extends typeof AnyModel> = ExtractModelOption<MClassType, 'idAttribute', 'id'>;
/**
 * 
 */
type ArrName<MClass extends typeof AnyModel> = ExtractModelOption<MClass, 'arrName', 'items'>;
/**
 * 
 */
type MapName<MClass extends typeof AnyModel> = ExtractModelOption<MClass, 'mapName', 'itemsById'>;

/**
 * 
 */
export type ExtractModelOption<
    MClassType extends typeof AnyModel,
    K extends keyof TableOpts,
    DefaultValue extends string
> = MClassType['options'] extends () => { [P in K]: infer R }
    ? R extends string
        ? R
        : DefaultValue
    : MClassType['options'] extends { [P in K]: infer R }
    ? R extends string
        ? R
        : DefaultValue
    : DefaultValue;

/**
 * 
 */
export type TableSpec = TableOpts;

/**
 * 
 */
export type SchemaSpec<Schema extends ModelClassMap> = {
  tables: {
    [K in keyof Schema]: ModelTableOpts<Schema[keyof Schema]>;
  };
};

/**
 * 
 */
export type ReduxAction<T = any> = {
  type: string;
  payload: T;
};

/**
 * 
 */
export type ForEachCallback<T> = {
  (elem: T): void;
};

/**
 * 
 */
export type WithForEach<T> = {
  forEach: (cb: ForEachCallback<T>) => void;
}

/**
 * 
 */
export type TableMap<Schema extends ModelClassMap> = { [K in keyof Schema]: Table<Schema[K]> };

/**
 * 
 */
export type EqualityFunc = (arg1: any, arg2: any) => boolean;

/**
 * 
 */
export type OrmSelector<
Result,
Schema extends ModelClassMap,
Args extends unknown[]
> = (session: Session<Schema>, ...args: Args) => Result;

/**
 * 
 */
export type Selector<
Schema extends ModelClassMap,
Result,
Args extends unknown[]
> = (state: OrmState<Schema>, ...args: Args) => Result;
