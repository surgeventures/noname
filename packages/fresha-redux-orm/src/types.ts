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
import { AnyModel, ModelClassMap } from "./Model";
import Session from "./Session";
import QuerySet from "./QuerySet";
import { Attribute, OneToOne, ManyToMany, ForeignKey } from "./fields";
import { Values } from "./utils";

export type AnyObject = Record<string, any>;
export type AnySchema = Record<string, typeof AnyModel>;

export type ModelId = number | string;

/**
 * Defines possible descriptors defined on the ORM side
 */
export type Descriptors = Attribute | OneToOne | ManyToMany | ForeignKey;

/**
 * Represents a map with descriptors for a specific model
 */
 export type DescriptorsMap<DescriptorTypes extends Descriptors> = { id: Attribute } & { [DescriptorName: string]: DescriptorTypes }

/**
 * Enumeration of possible relations used for defining interfaces with descriptors.
 */
export enum Relations {
  OneToOne = "oneToOne",
  ForeignKey = "foreignKey",
  ManyToMany = "manyToMany"
}

/**
 * An utility type, created for two purposes:
 *  1. Checks if each model have defined modelName field with a string literal type of that value.
 *  2. Checks if the modelName value matches with the key under which we add a model to the Schema type.
 *
 * Handling both cases preserves from possible typo's or modelName duplicates that can be caught by static checks.
 * Another value it brings, is a naming consistency.
 */
export type ValidateSchema<Schema extends ModelClassMap> = { [K in keyof Schema]: ModelName<Schema[K]> extends K ? Schema[K] : never };

/**
 * Returns the type of the passed model class.
 */
export type ModelClassType<MClass extends AnyModel> = ReturnType<MClass["getClass"]>;

/**
 * Returns the type of static modelName field. This field should be described by a string literal type.
 */
export type ModelName<MClassType extends typeof AnyModel> = MClassType['modelName'];

/**
 * Extracts all non-serializable types from the model's fields.
 *
 * It is being used to determine to which model types, the relationship can be created.
 */
export type ModelClassTypeFromModelFields<MClass extends AnyModel, MFields extends Required<ModelFields<MClass>> = Required<ModelFields<MClass>>> =
	{ [K in keyof MFields]:
    MFields[K] extends SessionBoundModel<infer Z>
      ? Z extends AnyModel
        ? ModelClassType<Z>
        : never
      : MFields[K] extends QuerySet<infer Z>
        ? Z
        : never
  }[keyof MFields];

/**
 * Extracts all keys of relationships that match with the source model.
 *
 * For given target model, it takes all relationship keys that matches the type of the source model.
 * It is being used to validate if provided related name matches any of the relation keys in target models.
 */
type SourceRelationshipKeysOfModel<
  SourceMClass extends AnyModel,
  TargetMClass extends AnyModel,
  MFields extends Required<ModelFields<TargetMClass>> = Required<ModelFields<TargetMClass>>
> = { [K in keyof MFields]:
    MFields[K] extends SessionBoundModel<infer Z>
      ? Z extends AnyModel
        ? Z extends SourceMClass
          ? K
          : never
        : never
      : MFields[K] extends QuerySet<infer Z>
        ? Z extends ModelClassType<SourceMClass>
          ? K
          : never
        : never
  }[keyof MFields];

/**
 * Iterates over the union of target model types and gives all field keys that are possible to set in the relations decorator.
 */
export type PossibleFieldKeys<SourceMClass extends AnyModel, TargetMClassType extends typeof AnyModel> = TargetMClassType extends typeof AnyModel ? SourceRelationshipKeysOfModel<SourceMClass, InstanceType<TargetMClassType>> : never;

/**
 * Imitates the model bound to the session.
 * 
 * ModelId type helps to ensure that every model's instance has the id included within its type declaration.
 */
export type SessionBoundModel<
  MClass extends AnyModel = AnyModel,
> = MClass & { id?: ModelId };

/**
 * Infers the fields type passed to a model. 
 */
export type ModelFields<MClass extends AnyModel> = ConstructorParameters<
  ModelClassType<MClass>
> extends [infer FirstConstructorParam]
 ? FirstConstructorParam extends ModelRefLike<infer ModelFields>
   ? ModelFields
   : never 
 : never;

 
 export type ModelConstructor<MClass extends AnyModel = AnyModel> = {
   new (props: Ref<MClass>): SessionBoundModel<MClass>; 
  }
  export type QuerySetConstructor<MClassType extends typeof AnyModel, Payload extends object = {}> = {
  new (modelClass: typeof AnyModel, clauses?: QueryClause<Payload>[], opts?: object): QuerySet<MClassType>;
}

/**
 * Handles relationships on the source model side.
 *
 * Each key points either to a single entity or a query set of entities on another model.
 */
export type TargetRelationship<
  MClass extends AnyModel,
  Relation extends Relations
> = Relation extends Relations.OneToOne
  ? SessionBoundModel<MClass>
  : Relation extends Relations.ForeignKey
    ? SessionBoundModel<MClass>
    : Relation extends Relations.ManyToMany
      ? QuerySet<ModelClassType<MClass>>
      : never;
      
/**
 * Handles relationships on the target model side.
 *
 * Defines keys used to access the Model foreign key is being defined from, from the target model.
 */
export type SourceRelationship<
  MClassType extends typeof AnyModel,
  Relation extends Relations
> = Relation extends Relations.OneToOne
  ? InstanceType<MClassType>
  : Relation extends Relations.ForeignKey
    ? QuerySet<MClassType>
    : Relation extends Relations.ManyToMany
      ? QuerySet<MClassType>
      : never;
      
/**
 * Possible types of relations and attributes that describe a single model.
 */
type ModelField = QuerySet<any> | AnyModel | Serializable | null;
  
/**
 * A map of possible types of relations and attributes that describe a single model.
 */
export type ModelFieldMap = {
  id?: ModelId;
  [K: string]: ModelField;
};
  
/**
 * A plain JS object representing the database entry.
 */
export type Ref<MClass extends AnyModel> = ConstructorParameters<
  ModelClassType<MClass>
> extends [infer FirstConstructorParam]
  ? FirstConstructorParam extends ModelRefLike
  ? FirstConstructorParam
  : never
  : never;

/**
 * Extends the plan JS object interface, representing the database entry, with {@link ModelField}
 * 
 * Mainly used in functions that manipulate db entries.
 */
export type RefWithFields<M extends AnyModel> = {
  [K in keyof ModelFields<M>]: ExcludeUndefined<ModelFields<M>[K]> extends QuerySet
    ? (SessionBoundModel<ExcludeUndefined<ModelFields<M>[K]> extends QuerySet<infer MClass> ? InstanceType<MClass> : never> | ModelId | null)[]
    : ExcludeUndefined<ModelFields<M>[K]> extends AnyModel
      ? ModelFields<M>[K] | ModelId | null
      : ModelFields<M>[K];
}; 
  
/**
 * Transforms the fields object to match the interface of the plain JS object in the database.
 * 
 * TODO: should firstly check if is undefined
 */
export type ModelRefLike<MFieldMap extends ModelFieldMap = ModelFieldMap> = {
  [K in keyof MFieldMap]: ExcludeUndefined<MFieldMap[K]> extends QuerySet
    ? never
    : ExcludeUndefined<MFieldMap[K]> extends AnyModel
      ? ModelId | undefined
      : MFieldMap[K];
};

/**
 * Excludes undefined type from an union of types.
 */
type ExcludeUndefined<T> = Exclude<T, undefined>;

/**
 * Optional ordering direction.
 */
export type SortOrder = 'asc' | 'desc' | boolean;

/**
 * Ordering clause.
 *
 * Either a key of SessionBoundModel or a evaluator function accepting plain object Model representation stored in the database.
 */
export type SortIteratee<MClass extends AnyModel> = keyof Ref<MClass> | { (row: Ref<MClass>): any };

/**
 * A primitive value
 */
 export type Primitive = number | string | boolean | undefined | null;

 /**
  * Serializable value: a primitive, undefined, a serializable object or an array of those
  */
 export type Serializable = Primitive | Serializable[] | {
     [K: string]: Serializable;
 };

/**
 * The state of a specific model's table
 */
export type TableState<MClassType extends typeof AnyModel> = {
  meta: {
    maxId?: number;
    [k: string]: any;
  };
  items: ModelId[];
  itemsById: Record<ModelId, Ref<InstanceType<MClassType>>>;
};

/**
 * Allows to access any models that have been bound to the session.
 */
export type SessionWithBoundModels<Schema extends ModelClassMap> = Session<Schema> & Schema;

/**
 * Represents the object with the ORM state type based on the model's schema.
 */
export type OrmState<Schema extends ModelClassMap> = { [K in keyof Schema]: TableState<Schema[K]> };

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
 * A database definition parametrized by schema made of models types
 */
export interface Database<Schema extends ModelClassMap> {
  describe(modelName: keyof Schema): Table<Values<Schema>>;
  getEmptyState(): OrmState<Schema>;
  query<Payload extends object = {}>(query: Query<Schema, Payload>, state: OrmState<Schema>): { rows: Ref<InstanceType<Values<Schema>>>[] };
  update<Payload extends object = object>(
    updateSpec: UpdateSpec<Schema>,
    tx: Transaction,
    state: OrmState<Schema>
  ): { status: UpdateStatus; state: OrmState<Schema>; payload: Payload };
}


/**
 * Table options used for {@link Table} customization.
 *
 * If no customizations were provided, the table uses following default options:
 * <br/>
 * ```typescript
 *  {
 *      idAttribute: 'id',
 *  }
 * ```
 * <br/>
 */
 export interface TableOpts {
  readonly idAttribute?: string;
  readonly arrName?: string;
  readonly mapName?: string;
}

/**
 * Schema specification required for a database creator
 */
export type SchemaSpec<Schema extends ModelClassMap> = {
  tables: {
    [K in keyof Schema]: TableOpts;
  };
};

/**
 * Store dispatched action type
 */
export type ReduxAction<Payload = {}> = {
  type: string;
  payload: Payload | null;
};


/**
 * Tables map created by the schema specification 
 */
export type TableMap<Schema extends ModelClassMap> = { [K in keyof Schema]: Table<Schema[K]> };


/**
 * The type of ORM selector creator
 */
export type OrmSelector<
  Schema extends ModelClassMap,
  Result,
  Args extends unknown[]
> = (session: SessionWithBoundModels<Schema>, ...args: Args) => Result;

/**
 * The type of memoized function
 */
export type Selector<
  Schema extends ModelClassMap,
  Result,
  Args extends unknown[]
> = (state: OrmState<Schema>, ...args: Args) => Result;
