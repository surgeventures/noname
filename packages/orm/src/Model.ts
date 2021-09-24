import Session from "./Session";
import QuerySet from "./QuerySet";
import { ManyToMany, ForeignKey, OneToOne, attr, RelationalField, Field } from "./fields";
import { CREATE, UPDATE, DELETE, FILTER } from "./constants";
import {
  normalizeEntity,
  arrayDiffActions,
  objectShallowEquals,
  m2mName,
} from "./utils";
import { Row, AnySchema, ModelData, ModelId, Query, ReduxAction, QuerySetConstructor, ModelAttrs, ModelFieldMap, SortIteratee, SortOrder, SessionBoundModel, SessionLike } from "./types";
import { castTo } from "./hacks";
import { Attribute } from ".";

/**
 * Generates a query specification to get the instance's
 * corresponding table row using its primary key.
 *
 * @private
 * @returns {Object}
 */
function getByIdQuery(modelInstance: AnyModel): Query<AnySchema, Record<string, ModelId>> {
  const modelClass = modelInstance.getClass();
  const { idAttribute, modelName } = modelClass;

  return {
    table: modelName,
    clauses: [
      {
        type: FILTER,
        payload: {
          [idAttribute]: modelInstance.getId(),
        },
      },
    ],
  };
}

type ModelFieldss = {
  id: Attribute;
  [key: string]: Field;
};

/**
 * The heart of an ORM, the data model.
 *
 * The fields you specify to the Model will be used to generate
 * a schema to the database, related property accessors, and
 * possibly through models.
 *
 * In each {@link Session} you instantiate from an {@link ORM} instance,
 * you will receive a session-specific subclass of this Model. The methods
 * you define here will be available to you in sessions.
 *
 * An instance of {@link Model} represents a record in the database, though
 * it is possible to generate multiple instances from the same record in the database.
 *
 * To create data models in your schema, subclass {@link Model}. To define
 * information about the data model, override static class methods. Define instance
 * logic by defining prototype methods (without `static` keyword).
 */
export default class Model<MClass extends typeof AnyModel = typeof AnyModel, Attrs extends ModelFieldMap = ModelFieldMap> {
  static modelName: string;
  static fields: ModelFieldss = {
    id: attr(),
  };
  static virtualFields: Record<string, RelationalField> = {};
  static readonly querySetClass = QuerySet;
  static isSetUp: boolean;
  static _session: SessionLike<any>;
  _fields: Partial<ModelAttrs<Attrs>>;
  static reducer: <Schema extends AnySchema, ModelClass extends Schema[keyof Schema]>(
    action: ReduxAction,
    modelClass: ModelClass,
    session: Session<Schema>
  ) => void;

  /**
   * Creates a Model instance from it's properties.
   * Don't use this to create a new record; Use the static method {@link Model#create}.
   * @param  {Object} props - the properties to instantiate with
   */
  constructor(props: Partial<ModelAttrs<Attrs>>) {
    this._initFields(props);
  }

  _initFields(props?: Partial<ModelAttrs<Attrs>>): void {
    const propsObj = Object(props) as ModelAttrs<Attrs>;
    this._fields = { ...propsObj };

    Object.keys(propsObj).forEach((fieldName) => {
      // In this case, we got a prop that wasn't defined as a field.
      // Assuming it's an arbitrary data field, making an instance-specific
      // descriptor for it.
      // Using the in operator as the property could be defined anywhere
      // on the prototype chain.
      if (!(fieldName in this)) {
        Object.defineProperty(this, fieldName, {
          get: () => this._fields[fieldName],
          set: (value) => this.set(fieldName, value),
          configurable: true,
          enumerable: true,
        });
      }
    });
  }

  static toString(): string {
    return `ModelClass: ${this.modelName}`;
  }

  /**
   * Returns the options object passed to the database for the table that represents
   * this Model class.
   *
   * Returns an empty object by default, which means the database
   * will use default options. You can either override this function to return the options
   * you want to use, or assign the options object as a static property of the same name to the
   * Model class.
   *
   * @return {Object} the options object passed to the database for the table
   *                  representing this Model class.
   */
  static options() {
    return {};
  }

  /**
   * @return {undefined}
   */
  static markAccessed(ids: ModelId[]): void {
    if (typeof this._session === "undefined") {
      throw new Error(
        [
          `Tried to mark rows of the ${this.modelName} model as accessed without a session. `,
          "Create a session using `session = orm.session()` and call ",
          `\`session["${this.modelName}"].markAccessed\` instead.`,
        ].join("")
      );
    }
    this.session.markAccessed(this.modelName, ids);
  }

  /**
   * @return {undefined}
   */
  static markFullTableScanned(): void {
    if (typeof this._session === "undefined") {
      throw new Error(
        [
          `Tried to mark the ${this.modelName} model as full table scanned without a session. `,
          "Create a session using `session = orm.session()` and call ",
          `\`session["${this.modelName}"].markFullTableScanned\` instead.`,
        ].join("")
      );
    }
    this.session.markFullTableScanned(this.modelName);
  }

  /**
   * Returns the id attribute of this {@link Model}.
   *
   * @return {string} The id attribute of this {@link Model}.
   */
  static get idAttribute(): string {
    if (typeof this._session === "undefined") {
      throw new Error(
        [
          `Tried to get the ${this.modelName} model's id attribute without a session. `,
          "Create a session using `session = orm.session()` and access ",
          `\`session["${this.modelName}"].idAttribute\` instead.`,
        ].join("")
      );
    }
    return this.session.db.describe(this.modelName).idAttribute;
  }

  /**
   * Connect the model class to a {@link Session}.
   *
   * @private
   * @param  {Session} session - The session to connect to.
   */
  static connect<S extends AnySchema>(session: Session<S>): void {
    if (!(session instanceof Session)) {
      throw new Error("A model can only be connected to instances of Session.");
    }
    this._session = session;
  }

  /**
   * Get the current {@link Session} instance.
   *
   * @private
   * @return {Session} The current {@link Session} instance.
   */
  static get session(): SessionLike<AnySchema> {
    return this._session;
  }

  /**
   * Returns an instance of the model's `querySetClass` field.
   * By default, this will be an empty {@link QuerySet}.
   *
   * @return {Object} An instance of the model's `querySetClass`.
   */
  static getQuerySet<M extends AnyModel>(): QuerySet<M> {
    const { querySetClass: QuerySetClass } = this;
    return new (castTo<QuerySetConstructor<M>>(QuerySetClass))(this);
  }

  /**
   * @return {undefined}
   */
  static invalidateClassCache(): void {
    this.isSetUp = false;
    this.virtualFields = {};
  }

  /**
   * @see {@link Model.getQuerySet}
   */
  static get query(): QuerySet<AnyModel> {
    return this.getQuerySet();
  }

  /**
   * @private
   */
  static _getTableOpts() {
    if (typeof this.options === "function") {
      return this.options();
    }
    return this.options;
  }

  /**
   * Creates a new record in the database, instantiates a {@link Model} and returns it.
   *
   * If you pass values for many-to-many fields, instances are created on the through
   * model as well.
   *
   * @param  {props} userProps - the new {@link Model}'s properties.
   * @return {Model} a new {@link Model} instance.
   */
  static create<Fields extends ModelFieldMap, Props extends ModelAttrs<Fields>>(userProps: Partial<Props>) {
    if (typeof this._session === "undefined") {
      throw new Error(
        [
          `Tried to create a ${this.modelName} model instance without a session. `,
          "Create a session using `session = orm.session()` and call ",
          `\`session["${this.modelName}"].create\` instead.`,
        ].join("")
      );
    }
    const props: Partial<Props> = { ...userProps };

    const m2mRelations: Record<string, ModelId[]> = {} as Record<string, ModelId[]>;

    const declaredFieldNames = Object.keys(this.fields);
    const declaredVirtualFieldNames = Object.keys(this.virtualFields);

    declaredFieldNames.forEach((key) => {
      const fields = this.fields;
      const field = fields[key];
      const valuePassed = userProps.hasOwnProperty(key);
      if (!(field instanceof ManyToMany)) {
        if (valuePassed) {
          const value = (userProps[key] as unknown) as AnyModel;
          (props as any)[key] = normalizeEntity(value);
        } else if ((field as Attribute).getDefault) {
          (props as any)[key] = (field as Attribute).getDefault!();
        }
      } else if (valuePassed) {
        // If a value is supplied for a ManyToMany field,
        // discard them from props and save for later processing.
        m2mRelations[key] = userProps[key] as ModelId[];
        delete props[key];
      }
    });

    // add backward many-many if required
    declaredVirtualFieldNames.forEach((key) => {
      if (!m2mRelations.hasOwnProperty(key)) {
        const field = this.virtualFields[key];
        if (userProps.hasOwnProperty(key) && field instanceof ManyToMany) {
          // If a value is supplied for a ManyToMany field,
          // discard them from props and save for later processing.
          m2mRelations[key] = userProps[key] as ModelId[];
          delete props[key];
        }
      }
    });

    const newEntry = this.session.applyUpdate<Partial<Props>>({
      action: CREATE,
      table: this.modelName,
      payload: props,
    });

    const ThisModel = this;
    const instance = new ThisModel<typeof ThisModel, Props>(newEntry);
    instance._refreshMany2Many(m2mRelations); // eslint-disable-line no-underscore-dangle
    return instance;
  }

  /**
   * Creates a new or update existing record in the database, instantiates a {@link Model} and returns it.
   *
   * If you pass values for many-to-many fields, instances are created on the through
   * model as well.
   *
   * @param  {props} userProps - the required {@link Model}'s properties.
   * @return {Model} a {@link Model} instance.
   */
  static upsert<Fields extends ModelFieldMap, Props extends ModelAttrs<Fields>>(userProps: Partial<Props>) {
    if (typeof this.session === "undefined") {
      throw new Error(
        [
          `Tried to upsert a ${this.modelName} model instance without a session. `,
          "Create a session using `session = orm.session()` and call ",
          `\`session["${this.modelName}"].upsert\` instead.`,
        ].join("")
      );
    }

    const { idAttribute } = this;
    if (userProps.hasOwnProperty(idAttribute)) {
      const id = userProps[idAttribute] as string;
      if (this.idExists(id)) {
        const model = this.withId(id)!;
        model.update(userProps);
        return model;
      }
    }

    return this.create(userProps);
  }

  /**
   * Returns a {@link Model} instance for the object with id `id`.
   * Returns `null` if the model has no instance with id `id`.
   *
   * You can use {@link Model#idExists} to check for existence instead.
   *
   * @param  {*} id - the `id` of the object to get
   * @throws If object with id `id` doesn't exist
   * @return {Model|null} {@link Model} instance with id `id`
   */
  static withId(id: ModelId) {
    return this.get({
      [this.idAttribute]: id,
    });
  }

  /**
   * Returns a boolean indicating if an entity
   * with the id `id` exists in the state.
   *
   * @param  {*}  id - a value corresponding to the id attribute of the {@link Model} class.
   * @return {Boolean} a boolean indicating if entity with `id` exists in the state
   *
   * @since 0.11.0
   */
  static idExists(id: ModelId) {
    return this.exists({
      [this.idAttribute]: id,
    });
  }

  /**
   * Returns a boolean indicating if an entity
   * with the given props exists in the state.
   *
   * @param  {*}  props - a key-value that {@link Model} instances should have to be considered as existing.
   * @return {Boolean} a boolean indicating if entity with `props` exists in the state
   */
  static exists<LookupObj extends {}>(lookupObj: LookupObj) {
    if (typeof this.session === "undefined") {
      throw new Error(
        [
          `Tried to check if a ${this.modelName} model instance exists without a session. `,
          "Create a session using `session = orm.session()` and call ",
          `\`session["${this.modelName}"].exists\` instead.`,
        ].join("")
      );
    }

    return Boolean(this._findDatabaseRows(lookupObj).length);
  }

  /**
   * Gets the {@link Model} instance that matches properties in `lookupObj`.
   * Throws an error if {@link Model} if multiple records match
   * the properties.
   *
   * @param  {Object} lookupObj - the properties used to match a single entity.
   * @throws {Error} If more than one entity matches the properties in `lookupObj`.
   * @return {Model} a {@link Model} instance that matches the properties in `lookupObj`.
   */
  static get<LookupObj extends {}>(lookupObj: LookupObj) {
    const ThisModel = this;

    const rows = this._findDatabaseRows(lookupObj);
    if (rows.length === 0) {
      return null;
    }
    if (rows.length > 1) {
      throw new Error(
        `Expected to find a single row in \`${this.modelName}.get\`. Found ${rows.length}.`
      );
    }

    return new ThisModel(rows[0]);
  }

  /**
   * Gets the {@link Model} class or subclass constructor (the class that
   * instantiated this instance).
   *
   * @return {Model} The {@link Model} class or subclass constructor used to instantiate
   *                 this instance.
   */
  getClass(): MClass {
    return this.constructor as MClass;
  }

  /**
   * Gets the id value of the current instance by looking up the id attribute.
   * @return {*} The id value of the current instance.
   */
  getId(): ModelId {
    return this._fields[this.getClass().idAttribute as keyof ModelAttrs<Attrs>] as unknown as ModelId;
  }

  /**
   * Returns a reference to the plain JS object in the store.
   * Make sure to not mutate this.
   *
   * @return {Object} a reference to the plain JS object in the store
   */
  get ref(): Row<this>[] {
    const ThisModel = this.getClass();

    // eslint-disable-next-line no-underscore-dangle
    return ThisModel._findDatabaseRows({
      [ThisModel.idAttribute]: this.getId(),
    })[0];
  }

  /**
   * Finds all rows in this model's table that match the given `lookupObj`.
   * If no `lookupObj` is passed, all rows in the model's table will be returned.
   *
   * @param  {*}  props - a key-value that {@link Model} instances should have to be considered as existing.
   * @return {Boolean} a boolean indicating if entity with `props` exists in the state
   * @private
   */
  static _findDatabaseRows<LookupObj extends {} = {}, M extends AnyModel = AnyModel>(lookupObj: LookupObj): Row<M>[] {
    const querySpec: Query<ModelClassMap, LookupObj> = {
      table: this.modelName,
      clauses: [],
    };
    if (lookupObj) {
      querySpec.clauses = [
        {
          type: FILTER,
          payload: lookupObj,
        },
      ];
    }
    return this.session.query(querySpec).rows as Row<M>[];
  }

  /**
   * Returns a string representation of the {@link Model} instance.
   *
   * @return {string} A string representation of this {@link Model} instance.
   */
  toString(): string {
    const ThisModel = this.getClass();
    const className = ThisModel.modelName;
    const fieldNames = Object.keys(ThisModel.fields) as string[];
    const fields = fieldNames
      .map((fieldName) => {
        const field = ThisModel.fields[fieldName];
        if (field instanceof ManyToMany) {
          const ids: ModelId[] = (castTo<ModelFieldss>(this)[fieldName] as unknown as QuerySet<this>)
            .toModelArray()
            .map((model) => model.getId());
          return `${fieldName}: [${ids.join(", ")}]`;
        }
        const val = this._fields[fieldName as keyof Attrs];
        return `${fieldName}: ${val}`;
      })
      .join(", ");
    return `${className}: {${fields}}`;
  }

  /**
   * Returns a boolean indicating if `otherModel` equals this {@link Model} instance.
   * Equality is determined by shallow comparing their attributes.
   *
   * This equality is used when you call {@link Model#update}.
   * You can prevent model updates by returning `true` here.
   * However, a model will always be updated if its relationships are changed.
   *
   * @param  {Model} otherModel - a {@link Model} instance to compare
   * @return {Boolean} a boolean indicating if the {@link Model} instance's are equal.
   */
  equals<OtherMClass extends typeof AnyModel = typeof AnyModel, OtherAttrs extends ModelFieldMap = ModelFieldMap>(otherModel: Model<OtherMClass, OtherAttrs>) {
    // eslint-disable-next-line no-underscore-dangle
    return objectShallowEquals(this._fields, otherModel._fields);
  }

  /**
   * Updates a property name to given value for this {@link Model} instance.
   * The values are immediately committed to the database.
   *
   * @param {string} propertyName - name of the property to set
   * @param {*} value - value assigned to the property
   * @return {undefined}
   */
  set(propertyName: string, value: any) {
    this.update({
      [propertyName]: value,
    } as any);
  }

  /**
   * Assigns multiple fields and corresponding values to this {@link Model} instance.
   * The updates are immediately committed to the database.
   *
   * @param  {Object} userMergeObj - an object that will be merged with this instance.
   * @return {undefined}
   */
  update(userMergeObj: Partial<ModelAttrs<Attrs>>): void {
    const ThisModel = this.getClass();
    if (typeof ThisModel.session === "undefined") {
      throw new Error(
        [
          `Tried to update a ${ThisModel.modelName} model instance without a session. `,
          "You cannot call `.update` on an instance that you did not receive from the database.",
        ].join("")
      );
    }

    const mergeObj = { ...userMergeObj };

    const { fields, virtualFields } = ThisModel;

    const m2mRelations: Record<string, ModelId[]> = {} as Record<string, ModelId[]>;

    // If an array of entities or id's is supplied for a
    // many-to-many related field, clear the old relations
    // and add the new ones.
    for (const mergeKey in mergeObj) {
      // eslint-disable-line no-restricted-syntax, guard-for-in
      const isRealField = fields.hasOwnProperty(mergeKey);

      if (isRealField) {
        const field = fields[mergeKey];

        if (field instanceof ForeignKey || field instanceof OneToOne) {
          // update one-one/fk relations
          mergeObj[mergeKey] = normalizeEntity(mergeObj[mergeKey] as AnyModel) as any;
        } else if (field instanceof ManyToMany) {
          // field is forward relation
          m2mRelations[mergeKey] = mergeObj[mergeKey] as ModelId[];
          delete mergeObj[mergeKey];
        }
      } else if (virtualFields.hasOwnProperty(mergeKey)) {
        const field = virtualFields[mergeKey];
        if (field instanceof ManyToMany) {
          // field is backward relation
          m2mRelations[mergeKey] = mergeObj[mergeKey] as ModelId[];
          delete mergeObj[mergeKey];
        }
      }
    }

    const mergedFields = {
      ...this._fields,
      ...mergeObj,
    };

    const updatedModel = new ThisModel(this._fields);
    updatedModel._initFields(mergedFields); // eslint-disable-line no-underscore-dangle

    // determine if model would have different related models after update
    updatedModel._refreshMany2Many(m2mRelations); // eslint-disable-line no-underscore-dangle
    const relationsEqual = Object.keys(m2mRelations).every(
      (name) =>
        !arrayDiffActions(
          (this as ModelData)[name] as ModelId[],
          (updatedModel as ModelData)[name] as ModelId[]
        )
    );
    const fieldsEqual = this.equals(updatedModel);

    // only update fields if they have changed (referentially)
    if (!fieldsEqual) {
      this._initFields(mergedFields);
    }

    // only update many-to-many relationships if any reference has changed
    if (!relationsEqual) {
      this._refreshMany2Many(m2mRelations);
    }

    // only apply the update if a field or relationship has changed
    if (!fieldsEqual || !relationsEqual) {
      ThisModel.session.applyUpdate({
        action: UPDATE,
        query: getByIdQuery(this),
        payload: mergeObj,
      });
    }
  }

  /**
   * Updates {@link Model} instance attributes to reflect the
   * database state in the current session.
   * @return {undefined}
   */
  refreshFromState(): void {
    this._initFields(this.ref);
  }

  /**
   * Deletes the record for this {@link Model} instance.
   * You'll still be able to access fields and values on the instance.
   *
   * @return {undefined}
   */
  delete(): void {
    const ThisModel = this.getClass();
    if (typeof ThisModel.session === "undefined") {
      throw new Error(
        [
          `Tried to delete a ${ThisModel.modelName} model instance without a session. `,
          "You cannot call `.delete` on an instance that you did not receive from the database.",
        ].join("")
      );
    }

    this._onDelete();
    ThisModel.session.applyUpdate({
      action: DELETE,
      query: getByIdQuery(this),
    });
  }

  /**
   * Update many-many relations for model.
   * @param relations
   * @return undefined
   * @private
   */
  _refreshMany2Many(relations: Record<string, (ModelId | AnyModel)[]>): void {
    const ThisModel = this.getClass();
    const { fields, virtualFields, modelName } = ThisModel;

    Object.keys(relations).forEach((name) => {
      const reverse = !fields.hasOwnProperty(name);
      const field = virtualFields[name];
      const values = relations[name];

      if (!Array.isArray(values)) {
        throw new TypeError(
          `Failed to resolve many-to-many relationship: ${modelName}[${name}] must be an array (passed: ${values})`
        );
      }

      const normalizedNewIds = values.map(normalizeEntity);
      const uniqueIds = [...new Set(normalizedNewIds)];

      if (normalizedNewIds.length !== uniqueIds.length) {
        throw new Error(
          `Found duplicate id(s) when passing "${normalizedNewIds}" to ${ThisModel.modelName}.${name} value`
        );
      }

      const throughModelName =
        field.through || m2mName(ThisModel.modelName, name);
      const ThroughModel = castTo<ModelClassMap>(ThisModel.session)[
        throughModelName
      ];

      let fromField: string;
      let toField: string;

      if (!reverse) {
        ({ from: fromField, to: toField } = field.throughFields);
      } else {
        ({ from: toField, to: fromField } = field.throughFields);
      }

      const currentIds = ThroughModel.filter(
        (through) =>
          (through as ModelData)[fromField] === (this as ModelData)[ThisModel.idAttribute]
      )
        .toRefArray()
        .map((ref) => castTo<ModelId>(ref[toField]));

      const diffActions = arrayDiffActions(currentIds, normalizedNewIds);

      if (diffActions) {
        const { delete: idsToDelete, add: idsToAdd } = diffActions;
        if (idsToDelete.length > 0) {
          // Przyklad gdzie tworzac instancje, mozemy przekazywac nie tylko idki
          (this as ModelData)[name].remove(...idsToDelete);
        }
        if (idsToAdd.length > 0) {
          (this as ModelData)[name].add(...idsToAdd);
        }
      }
    });
  }

  /**
   * @return {undefined}
   * @private
   */
  _onDelete(): void {
    const { virtualFields } = this.getClass();
    for (const key in virtualFields) {
      // eslint-disable-line
      const field = virtualFields[key];
      if (field instanceof ManyToMany) {
        // Delete any many-to-many rows the entity is included in.
        (this as ModelData)[key].clear();
      } else if (field instanceof ForeignKey) {
        const relatedQs = (this as ModelData)[key];
        if (relatedQs.exists()) {
          relatedQs.update({ [field.relatedName!]: null });
        }
      } else if (field instanceof OneToOne) {
        // Set null to any foreign keys or one to ones pointed to
        // this instance.
        if ((this as ModelData)[key] !== null) {
          (this as ModelData)[key][field.relatedName!] = null;
        }
      }
    }
  }

  static count(): number {
    return this.getQuerySet().count();
  }

  static at(index: number): SessionBoundModel | undefined {
    return this.getQuerySet().at(index);
  }

  static all(): QuerySet {
    return this.getQuerySet().all();
  }

  static first(): SessionBoundModel | undefined {
    return this.getQuerySet().first();
  }

  static last(): SessionBoundModel | undefined {
    return this.getQuerySet().last();
  }

  static filter(lookupObj: Partial<Row<AnyModel>> | ((row: Row<AnyModel>) => boolean)): QuerySet {
    return this.getQuerySet().filter(lookupObj);
  }

  static exclude(lookupObj: Partial<Row<AnyModel>> | ((row: Row<AnyModel>) => boolean)): QuerySet {
    return this.getQuerySet().exclude(lookupObj);
  }

  static orderBy(
    iteratees: SortIteratee<AnyModel> | ReadonlyArray<SortIteratee<AnyModel>>,
    orders?: SortOrder | ReadonlyArray<SortOrder>
  ): QuerySet {
    return this.getQuerySet().orderBy(iteratees, orders);
  }

  static update(mergeObj: Partial<ModelAttrs>): void {
    return this.getQuerySet().update(mergeObj);
  }

  static delete(): void {
    return this.getQuerySet().delete();
  }
}

export class AnyModel extends Model {}

export type ModelClassMap = Record<string, typeof AnyModel>;
