import { AnyModel } from "./Model";
import ORM from "./ORM";
import {
  attrDescriptor,
  forwardsManyToOneDescriptor,
  backwardsManyToOneDescriptor,
  forwardsOneToOneDescriptor,
  backwardsOneToOneDescriptor,
  manyToManyDescriptor,
} from "./descriptors";
import { ModelClassMap } from "./Model";

import {
  m2mName,
  m2mToFieldName,
  m2mFromFieldName,
  reverseFieldName,
  reverseFieldErrorMessage,
} from "./utils";
import { castTo } from "./hacks";

/**
 * Contains the logic for how fields on {@link Model}s work
 * and which descriptors must be installed.
 *
 * If your goal is to define fields on a Model class,
 * please use the more convenient methods {@link attr},
 * {@link fk}, {@link many} and {@link oneToOne}.
 *
 * @module fields
 */

type FieldInstallerTemplateOptions<Schema extends ModelClassMap> = {
  field: Field;
  fieldName: string;
  model: Schema[keyof Schema];
  orm: ORM<Schema>;
};

/**
 * Defines algorithm for installing a field onto a model and related models.
 * Conforms to the template method behavioral design pattern.
 * @private
 */
abstract class FieldInstallerTemplate<Schema extends ModelClassMap = ModelClassMap> {
  field: Field;
  fieldName: string;
  model: Schema[keyof Schema];
  orm: ORM<Schema>;
  _toModel: Schema[keyof Schema] | null;
  _throughModel: typeof AnyModel | null;

  constructor(opts: FieldInstallerTemplateOptions<Schema>) {
    this.field = opts.field;
    this.fieldName = opts.fieldName;
    this.model = opts.model;
    this.orm = opts.orm;
    /**
     * the field itself has no knowledge of the model
     * it is being installed upon; we need to inform it
     * that it is a self-referencing field for the field
     * to be able to make better informed decisions
     */
    if (this.field.references(this.model)) {
      castTo<RelationalField>(this.field).toModelName = "this";
    }
  }

  get toModel() {
    if (typeof this._toModel === "undefined") {
      const { toModelName } = this.field as RelationalField;
      if (!toModelName) {
        this._toModel = null;
      } else if (toModelName === "this") {
        this._toModel = this.model;
      } else {
        this._toModel = this.orm.get(toModelName);
      }
    }
    return this._toModel;
  }

  get throughModel() {
    if (typeof this._throughModel === "undefined") {
      const throughModelName = this.field.getThroughModelName(
        this.fieldName,
        this.model
      );
      if (!throughModelName) {
        this._throughModel = null;
      } else {
        this._throughModel = this.orm.get(throughModelName);
      }
    }
    return this._throughModel;
  }

  get backwardsFieldName() {
    return this.field.getBackwardsFieldName(this.model);
  }

  abstract installForwardsDescriptor(): void;
  abstract installForwardsVirtualField(): void;
  abstract installBackwardsDescriptor(): void;
  abstract installBackwardsVirtualField(): void;

  run() {
    if (this.field.installsForwardsDescriptor) {
      this.installForwardsDescriptor();
    }
    if (this.field.installsForwardsVirtualField) {
      this.installForwardsVirtualField();
    }
    /**
     * Install a backwards field on a model as a consequence
     * of having installed the forwards field on another model.
     */
    if (this.field.installsBackwardsDescriptor) {
      this.installBackwardsDescriptor();
    }
    if (this.field.installsBackwardsVirtualField) {
      this.installBackwardsVirtualField();
    }
  }
}

/**
 * Default implementation for the template method in FieldInstallerTemplate.
 * @private
 */
class DefaultFieldInstaller extends FieldInstallerTemplate {
  installForwardsDescriptor() {
    Object.defineProperty(
      this.model.prototype,
      this.fieldName,
      this.field.createForwardsDescriptor(
        this.fieldName,
        this.model,
        this.toModel!,
        this.throughModel!
      )
    );
  }

  installForwardsVirtualField() {
    this.model.virtualFields[
      this.fieldName
    ] = castTo<RelationalField>(this.field).createForwardsVirtualField(
      this.fieldName,
      this.model,
      this.toModel!,
      this.throughModel!
    );
  }

  installBackwardsDescriptor() {
    const backwardsDescriptor = Object.getOwnPropertyDescriptor(
      this.toModel!.prototype,
      this.backwardsFieldName
    );
    if (backwardsDescriptor) {
      throw new Error(
        reverseFieldErrorMessage(
          this.model.modelName,
          this.fieldName,
          this.toModel!.modelName,
          this.backwardsFieldName
        )
      );
    }

    // install backwards descriptor
    Object.defineProperty(
      this.toModel!.prototype,
      this.backwardsFieldName,
      this.field.createBackwardsDescriptor(
        this.fieldName,
        this.model,
        this.toModel!,
        this.throughModel!
      )
    );
  }

  installBackwardsVirtualField() {
    this.toModel!.virtualFields[
      this.backwardsFieldName
    ] = castTo<RelationalField>(this.field).createBackwardsVirtualField(
      this.fieldName,
      this.model,
      this.toModel!,
      this.throughModel!
    );
  }
}

/**
 * @ignore
 */
export abstract class Field {
  get installerClass() {
    return DefaultFieldInstaller;
  }

  references(_model: typeof AnyModel) {
    return false;
  }

  getThroughModelName(_fieldName: string, _model: typeof AnyModel): string | null {
    return null;
  }

  get installsForwardsDescriptor() {
    return true;
  }

  get installsForwardsVirtualField() {
    return false;
  }

  get installsBackwardsDescriptor() {
    return false;
  }

  get installsBackwardsVirtualField() {
    return false;
  }

  abstract getBackwardsFieldName(model: typeof AnyModel): string;
  abstract createForwardsDescriptor(
    fieldName: string,
    model: typeof AnyModel,
    toModel: typeof AnyModel,
    throughModel: typeof AnyModel
  ): PropertyDescriptor;
  abstract createBackwardsDescriptor(
    fieldName: string,
    model: typeof AnyModel,
    toModel: typeof AnyModel,
    throughModel: typeof AnyModel
  ): PropertyDescriptor;
}

export type AttributeOptions = {
  getDefault?: () => any;
};

/**
 * @ignore
 */
export class Attribute extends Field {
  opts: AttributeOptions;
  getDefault: (() => any) | undefined;

  constructor(opts?: AttributeOptions) {
    super();
    this.opts = opts || {};

    if (this.opts.hasOwnProperty("getDefault")) {
      this.getDefault = this.opts.getDefault;
    }
  }

  createForwardsDescriptor(
    fieldName: string,
    _model: typeof AnyModel,
    _toModel: typeof AnyModel,
    _throughModel: typeof AnyModel
  ): PropertyDescriptor {
    return attrDescriptor(fieldName);
  }

  createBackwardsDescriptor(
    _fieldName: string,
    _model: typeof AnyModel,
    _toModel: typeof AnyModel,
    _throughModel: typeof AnyModel
  ): PropertyDescriptor {
    throw new Error("Method not implemented.");
  }

  createBackwardsVirtualField(
    _fieldName: string,
    _model: typeof AnyModel,
    _toModel: typeof AnyModel,
    _throughModel: typeof AnyModel
  ): Field {
    throw new Error("Method not implemented.");
  }

  getBackwardsFieldName(_model: typeof AnyModel): string {
    throw new Error("Method not implemented.");
  }
}

export type RelationalFieldOpts = {
  to: string;
  relatedName?: string;
  through?: string;
  throughFields?: { from: string; to: string } | [string, string];
  as?: string;
};

export type RelationalFieldConstructor = {
  new (arg1: RelationalFieldOpts | string, arg2?: string): RelationalField;
};

/**
 * @ignore
 */
export abstract class RelationalField extends Field {
  toModelName: string;
  relatedName?: string;
  through?: string;
  throughFields?: { from: string; to: string } | [string, string];
  as?: string;
  toModel: typeof AnyModel;

  constructor(arg1: RelationalFieldOpts | string, arg2?: string) {
    super();
    if (typeof arg1 === "object" && arg2 == null) {
      const opts = arg1;
      this.toModelName = opts.to;
      this.relatedName = opts.relatedName;
      this.through = opts.through;
      this.throughFields = opts.throughFields;
      this.as = opts.as;
    } else {
      this.toModelName = arg1 as string;
      this.relatedName = arg2;
    }
  }

  abstract createForwardsVirtualField(
    fieldName: string,
    model: typeof AnyModel,
    toModel: typeof AnyModel,
    throughModel: typeof AnyModel
  ): RelationalField;

  getClass() {
    return this.constructor as RelationalFieldConstructor;
  }

  getBackwardsFieldName(model: typeof AnyModel) {
    return this.relatedName || reverseFieldName(model.modelName);
  }

  createBackwardsVirtualField(
    fieldName: string,
    model: typeof AnyModel,
    _toModel: typeof AnyModel,
    _throughModel: typeof AnyModel
  ) {
    const ThisField = this.getClass();
    return new ThisField(model.modelName, fieldName);
  }

  get installsBackwardsVirtualField() {
    return true;
  }

  get installsBackwardsDescriptor() {
    return true;
  }

  references(model: typeof AnyModel) {
    return this.toModelName === model.modelName;
  }

  get installerClass() {
    return class AliasedForwardsDescriptorInstaller extends DefaultFieldInstaller {
      installForwardsDescriptor() {
        Object.defineProperty(
          this.model.prototype,
          this.field.as || this.fieldName, // use supplied name if possible
          this.field.createForwardsDescriptor(
            this.fieldName,
            this.model,
            this.toModel!,
            this.throughModel!
          )
        );
      }
    };
  }
}

/**
 * @ignore
 */
export class ForeignKey extends RelationalField {
  createForwardsVirtualField(
    _fieldName: string,
    _model: typeof AnyModel,
    _toModel: typeof AnyModel,
    _throughModel: typeof AnyModel
  ): RelationalField {
    throw new Error("Method not implemented.");
  }
  createForwardsDescriptor(
    fieldName: string,
    _model: typeof AnyModel,
    toModel: typeof AnyModel,
    _throughModel: typeof AnyModel
  ) {
    return forwardsManyToOneDescriptor(fieldName, toModel.modelName);
  }

  createBackwardsDescriptor(
    fieldName: string,
    model: typeof AnyModel,
    _toModel: typeof AnyModel,
    _throughModel: typeof AnyModel
  ) {
    return backwardsManyToOneDescriptor(fieldName, model.modelName);
  }
}

/**
 * @ignore
 */
export class ManyToMany extends RelationalField {
  getDefault() {
    return [];
  }

  getThroughModelName(fieldName: string, model: typeof AnyModel) {
    return this.through || m2mName(model.modelName, fieldName);
  }

  createForwardsDescriptor(
    fieldName: string,
    model: typeof AnyModel,
    toModel: typeof AnyModel,
    throughModel: typeof AnyModel
  ) {
    return manyToManyDescriptor(
      model.modelName,
      toModel.modelName,
      throughModel.modelName,
      this.getThroughFields(fieldName, model, toModel, throughModel),
      false
    );
  }

  createBackwardsDescriptor(
    fieldName: string,
    model: typeof AnyModel,
    toModel: typeof AnyModel,
    throughModel: typeof AnyModel
  ) {
    return manyToManyDescriptor(
      model.modelName,
      toModel.modelName,
      throughModel.modelName,
      this.getThroughFields(fieldName, model, toModel, throughModel),
      true
    );
  }

  createBackwardsVirtualField(
    fieldName: string,
    model: typeof AnyModel,
    toModel: typeof AnyModel,
    throughModel: typeof AnyModel
  ) {
    const ThisField = this.getClass();
    return new ThisField({
      to: model.modelName,
      relatedName: fieldName,
      through: throughModel.modelName,
      throughFields: this.getThroughFields(
        fieldName,
        model,
        toModel,
        throughModel
      ),
    });
  }

  createForwardsVirtualField(
    fieldName: string,
    model: typeof AnyModel,
    toModel: typeof AnyModel,
    throughModel: typeof AnyModel
  ) {
    const ThisField = this.getClass();
    return new ThisField({
      to: toModel.modelName,
      relatedName: fieldName,
      through: this.through,
      throughFields: this.getThroughFields(
        fieldName,
        model,
        toModel,
        throughModel
      ),
    });
  }

  get installsForwardsVirtualField() {
    return true;
  }

  getThroughFields(
    _fieldName: string,
    model: typeof AnyModel,
    toModel: typeof AnyModel,
    throughModel: typeof AnyModel
  ): { from: string; to: string } {
    if (this.throughFields) {
      const [fieldAName, fieldBName] = this.throughFields as [string, string];
      const fieldA = throughModel.fields[fieldAName];
      return {
        to: fieldA.references(toModel) ? fieldAName : fieldBName,
        from: fieldA.references(toModel) ? fieldBName : fieldAName,
      };
    }

    if (model.modelName === toModel.modelName) {
      /**
       * we have no way of determining the relationship's
       * direction here, so we need to assume that the user
       * did not use a custom through model
       * see ORM#registerManyToManyModelsFor
       */
      return {
        to: m2mToFieldName(toModel.modelName),
        from: m2mFromFieldName(model.modelName),
      };
    }

    /**
     * determine which field references which model
     * and infer the directions from that
     */
    const throughModelFieldReferencing = (otherModel: typeof AnyModel) =>
      Object.keys(throughModel.fields).find((someFieldName) =>
        throughModel.fields[someFieldName].references(otherModel)
      );

    return {
      to: throughModelFieldReferencing(toModel)!,
      from: throughModelFieldReferencing(model)!,
    };
  }
}

/**
 * @ignore
 */
export class OneToOne extends RelationalField {
  createForwardsVirtualField(
    _fieldName: string,
    _model: typeof AnyModel,
    _toModel: typeof AnyModel,
    _throughModel: typeof AnyModel
  ): RelationalField {
    throw new Error("Method not implemented.");
  }
  getBackwardsFieldName(model: typeof AnyModel) {
    return this.relatedName || model.modelName.toLowerCase();
  }

  createForwardsDescriptor(
    fieldName: string,
    _model: typeof AnyModel,
    toModel: typeof AnyModel,
    _throughModel: typeof AnyModel
  ) {
    return forwardsOneToOneDescriptor(fieldName, toModel.modelName);
  }

  createBackwardsDescriptor(
    fieldName: string,
    model: typeof AnyModel,
    _toModel: typeof AnyModel,
    _throughModel: typeof AnyModel
  ) {
    return backwardsOneToOneDescriptor(fieldName, model.modelName);
  }
}

/**
 * Defines a value attribute on the model.
 * Though not required, it is recommended to define this for each non-foreign key you wish to use.
 * Getters and setters need to be defined on each Model
 * instantiation for undeclared data fields, which is slower.
 * You can use the optional `getDefault` parameter to fill in unpassed values
 * to {@link Model.create}, such as for generating ID's with UUID:
 *
 * ```javascript
 * import getUUID from 'your-uuid-package-of-choice';
 *
 * fields = {
 *   id: attr({ getDefault: () => getUUID() }),
 *   title: attr(),
 * }
 * ```
 *
 * @global
 *
 * @param  {Object} [opts]
 * @param {Function} [opts.getDefault] - if you give a function here, it's return
 *                                       value from calling with zero arguments will
 *                                       be used as the value when creating a new Model
 *                                       instance with {@link Model#create} if the field
 *                                       value is not passed.
 * @return {Attribute}
 */
export function attr(opts?: AttributeOptions) {
  return new Attribute(opts);
}

/**
 * Defines a foreign key on a model, which points
 * to a single entity on another model.
 *
 * You can pass arguments as either a single object,
 * or two arguments.
 *
 * If you pass two arguments, the first one is the name
 * of the Model the foreign key is pointing to, and
 * the second one is an optional related name, which will
 * be used to access the Model the foreign key
 * is being defined from, from the target Model.
 *
 * If the related name is not passed, it will be set as
 * `${toModelName}Set`.
 *
 * If you pass an object to `fk`, it has to be in the form
 *
 * ```javascript
 * fields = {
 *   author: fk({ to: 'Author', relatedName: 'books' })
 * }
 * ```
 *
 * Which is equal to
 *
 * ```javascript
 * fields = {
 *   author: fk('Author', 'books'),
 * }
 * ```
 *
 * @global
 *
 * @param  {string|Object} toModelNameOrObj - the `modelName` property of
 *                                            the Model that is the target of the
 *                                            foreign key, or an object with properties
 *                                            `to` and optionally `relatedName`.
 * @param {string} [relatedName] - if you didn't pass an object as the first argument,
 *                                 this is the property name that will be used to
 *                                 access a QuerySet the foreign key is defined from,
 *                                 from the target model.
 * @return {ForeignKey}
 */
export function fk(toModelName: string, relatedName?: string): ForeignKey;
export function fk(opts: RelationalFieldOpts): ForeignKey;

export function fk(
  arg1: string | RelationalFieldOpts,
  arg2?: string
): ForeignKey {
  return new ForeignKey(arg1, arg2);
}

/**
 * Defines a many-to-many relationship between
 * this (source) and another (target) model.
 *
 * The relationship is modeled with an extra model called the through model.
 * The through model has foreign keys to both the source and target models.
 *
 * You can define your own through model if you want to associate more information
 * to the relationship. A custom through model must have at least two foreign keys,
 * one pointing to the source Model, and one pointing to the target Model.
 *
 * If you have more than one foreign key pointing to a source or target Model in the
 * through Model, you must pass the option `throughFields`, which is an array of two
 * strings, where the strings are the field names that identify the foreign keys to
 * be used for the many-to-many relationship. Redux-ORM will figure out which field name
 * points to which model by checking the through Model definition.
 *
 * Unlike `fk`, this function accepts only an object argument.
 *
 * ```javascript
 * class Authorship extends Model {}
 * Authorship.modelName = 'Authorship';
 * Authorship.fields = {
 *   author: fk('Author', 'authorships'),
 *   book: fk('Book', 'authorships'),
 * };
 *
 * class Author extends Model {}
 * Author.modelName = 'Author';
 * Author.fields = {
 *   books: many({
 *     to: 'Book',
 *     relatedName: 'authors',
 *     through: 'Authorship',
 *
 *     // this is optional, since Redux-ORM can figure
 *     // out the through fields itself as there aren't
 *     // multiple foreign keys pointing to the same models.
 *     throughFields: ['author', 'book'],
 *   })
 * };
 *
 * class Book extends Model {}
 * Book.modelName = 'Book';
 * ```
 *
 * You should only define the many-to-many relationship on one side. In the
 * above case of Authors to Books through Authorships, the relationship is
 * defined only on the Author model.
 *
 * @global
 *
 * @param  {Object} options - options
 * @param  {string} options.to - the `modelName` attribute of the target Model.
 * @param  {string} [options.through] - the `modelName` attribute of the through Model which
 *                                    must declare at least one foreign key to both source and
 *                                    target Models. If not supplied, Redux-Orm will autogenerate
 *                                    one.
 * @param  {string[]} [options.throughFields] - this must be supplied only when a custom through
 *                                            Model has more than one foreign key pointing to
 *                                            either the source or target mode. In this case
 *                                            Redux-ORM can't figure out the correct fields for
 *                                            you, you must provide them. The supplied array should
 *                                            have two elements that are the field names for the
 *                                            through fields you want to declare the many-to-many
 *                                            relationship with. The order doesn't matter;
 *                                            Redux-ORM will figure out which field points to
 *                                            the source Model and which to the target Model.
 * @param  {string} [options.relatedName] - the attribute used to access a QuerySet
 *                                          of source Models from target Model.
 * @return {ManyToMany}
 */
export function many(toModelName: string, relatedName?: string): ManyToMany;
export function many(opts: RelationalFieldOpts): ManyToMany;

export function many(arg1: RelationalFieldOpts | string, arg2?: string) {
  return new ManyToMany(arg1, arg2);
}

/**
 * Defines a one-to-one relationship. In database terms, this is a foreign key with the
 * added restriction that only one entity can point to single target entity.
 *
 * The arguments are the same as with `fk`. If `relatedName` is not supplied,
 * the source model name in lowercase will be used. Note that with the one-to-one
 * relationship, the `relatedName` should be in singular, not plural.
 *
 * @global
 *
 * @param  {string|Object} toModelNameOrObj - the `modelName` property of
 *                                            the Model that is the target of the
 *                                            foreign key, or an object with properties
 *                                            `to` and optionally `relatedName`.
 * @param {string} [relatedName] - if you didn't pass an object as the first argument,
 *                                 this is the property name that will be used to
 *                                 access a Model the foreign key is defined from,
 *                                 from the target Model.
 * @return {OneToOne}
 */
export function oneToOne(toModelName: string, relatedName?: string): OneToOne;
export function oneToOne(opts: RelationalFieldOpts): OneToOne;

export function oneToOne(arg1: string | RelationalFieldOpts, arg2?: string) {
  return new OneToOne(arg1, arg2);
}
