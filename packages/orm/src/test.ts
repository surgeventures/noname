import { attr } from ".";
import Model from "./Model";
import { ModelId, AnyObject } from "./types";

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

class QuerySet {}
// class Model {

// 	getClass(): any {}
// }

export const enum Relations {
    OneToOne = 'oneToOne',
    ForeignKey = 'foreignKey',
    ManyToMany = 'manyToMany',
  }

  /**
   * Handles relationships on the target model side.
   *
   * Defines keys used to access the Model foreign key is being defined from, from the target model.
   */
  export type SourceModelRelationship<
    ModelType extends AnyModel,
    Relation extends Relations
  > = Relation extends Relations.OneToOne
    ? TestSourceSessionBoundModel<ModelFields<ModelType>>
    : Relation extends Relations.ForeignKey
    ? QuerySet
    : Relation extends Relations.ManyToMany
    ? QuerySet
    : never;

    export type TargetModelRelationship<
    ModelType extends AnyModel,
    Relation extends Relations
  > = Relation extends Relations.OneToOne
    ? ModelType extends AnyModel
      ? TargetSessionBoundModel<ModelType>
      : never
    : Relation extends Relations.ForeignKey
    ? ModelType extends AnyModel
      ? TargetSessionBoundModel<ModelType>
      : never
    : Relation extends Relations.ManyToMany
    ? ModelType extends AnyModel
      ? QuerySet
      : never
    : never;

    export type Ref<M extends Model> = {
        [K in keyof ModelFields<M>]: ModelFields<M>[K] extends TargetModelRelationship<M, Relations>
          ? ModelFields<M>[K] extends TargetModelRelationship<
              M,
              Relations.OneToOne | Relations.ForeignKey
            >
            ? ModelId | undefined
            : never
          : ModelFields<M>[K];
      };

class AnyModel extends Model {}

export type ModelClass<M extends AnyModel> = ReturnType<M['getClass']>;

export type ModelField = QuerySet | TargetSessionBoundModel | SourceSessionBoundModel | Serializable;

/**
 * Map of fields restriction to supported field types.
 */
export interface ModelFieldMap {
    [K: string]: ModelField;
}

export type ModelFields<M extends Model> = ConstructorParameters<ModelClass<M>> extends [infer U]
? U extends ModelFieldMap
		? U
		: never
: never;

export type SessionBoundModelField<M extends AnyModel, K extends keyof ModelFields<M>> = ModelFields<
M
>[K] extends AnyModel
? TargetSessionBoundModel<ModelFields<M>[K]>
: ModelFields<M>[K];

export type SourceSessionBoundModel<M extends Model = any, InstanceProps extends object = {}> = Omit<M, 'ref'> &
InstanceProps & { [K in keyof ModelFields<M>]: ModelFields<M>[K] } & { ref: {
    [K in keyof ModelFields<M>]: ModelFields<M>[K] extends SourceModelRelationship<
      M,
      Relations.OneToOne | Relations.ManyToMany
    >
      ? never
      : ModelFields<M>[K] extends SourceModelRelationship<M, Relations.ForeignKey>
      ? ModelId | undefined
      : ModelFields<M>[K] extends TargetModelRelationship<M, Relations>
      ? ModelFields<M>[K] extends TargetModelRelationship<M, Relations.ForeignKey>
        ? ModelId | undefined
        : never
      : ModelFields<M>[K];
  } };

  type TestSourceSessionBoundModel<
    Attrs extends AnyObject = AnyObject,
  > = {
    ref: {
      [K in keyof Attrs]: Attrs[K] extends SourceModelRelationship<
        Model,
        Relations.OneToOne | Relations.ManyToMany
      >
        ? never
        : Attrs[K] extends SourceModelRelationship<Model, Relations.ForeignKey>
        ? ModelId | undefined
        : Attrs[K] extends TargetModelRelationship<Model, Relations>
        ? Attrs[K] extends TargetModelRelationship<Model, Relations.ForeignKey>
          ? ModelId | undefined
          : never
        : Attrs[K];
    };
  } & Omit<TargetSessionBoundModel<Model<typeof AnyModel, Attrs>>, 'ref'>;

export type TargetSessionBoundModel<M extends AnyModel = any, InstanceProps extends object = {}> = Omit<M, 'ref'> &
{ [K in keyof ModelFields<M>]: SessionBoundModelField<M, K> } &
InstanceProps & { ref: Ref<M> };

export class Printer extends Model<typeof Printer, { hej: string, book: unknown }> {
    static modelName = "Printer";
    static fields = {
      id: attr(),
      name: attr(),
      model: attr(),
    };
  }

export class Book extends Model<typeof Book, { asdasd: string, printer: TargetModelRelationship<Printer, Relations.OneToOne> }> {
    static modelName = "Book";
    static fields = {
      id: attr(),
      name: attr(),
      releaseYear: attr(),
    };
  }

type Test = TargetSessionBoundModel<Book, { asdasd: string, printer: TargetModelRelationship<Printer, Relations.OneToOne> }>;

const obj = {} as Test;
obj.printer.book.ref
const book = obj.printer.book as SourceModelRelationship<Book, Relations.OneToOne>;
type Z = Ref<Printer>;
const zObj = {} as Z;
zObj.

