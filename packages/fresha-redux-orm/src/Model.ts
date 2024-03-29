import Session from "./Session";
import QuerySet from "./QuerySet";
import { attr, Attribute, ManyToMany, ForeignKey, OneToOne, RelationalField } from "./fields";
import { CREATE, UPDATE, DELETE, FILTER } from "./constants";
import {
  normalizeEntity,
  arrayDiffActions,
  objectShallowEquals,
  m2mName,
  Values,
} from "./utils";
import { Descriptors, DescriptorsMap, AnySchema, AnyObject, ModelId, Query, ReduxAction, QuerySetConstructor, RefFromFields, ModelFieldMap, SortIteratee, SortOrder, SessionBoundModel, SessionWithBoundModels, ModelConstructor, RefWithFields, Ref, MapTypes, AnyMappingType } from "./types";
import { castTo } from "./hacks";
import { getDescriptors, ModelDescriptorsRegistry } from "./modelDescriptorsRegistry";

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
export default class Model<MClassType extends typeof AnyModel = typeof AnyModel, MFieldMap extends ModelFieldMap = ModelFieldMap> {
  static fields: DescriptorsMap<Descriptors> = {
    id: attr()
  };
  static modelName: string;
  static virtualFields: Record<string, RelationalField> = {};
  static readonly querySetClass = QuerySet;
  static isSetUp: boolean;
  static _session: SessionWithBoundModels<any>;
  _fields: RefFromFields<MFieldMap>;
  static reducer: <Schema extends AnySchema, ModelClassType extends Values<Schema>>(
    action: ReduxAction<Ref<InstanceType<ModelClassType>>>,
    modelClass: ModelClassType,
    session: Session<Schema>
  ) => void;

  /**
   * Creates a Model instance from it's properties.
   * Don't use this to create a new record; Use the static method {@link Model#create}.
   * @param  {Object} props - the properties to instantiate with
   */
  constructor(props: MFieldMap) {
    // Using MFieldMap for types deduction to break the circular type references
    // Constructor wasn't designed for creating orm records, it can accept any values
    this._initFields(props as unknown as RefFromFields<MFieldMap>);
  }

  _initFields(props?: RefFromFields<MFieldMap>): void {
    const propsObj = Object(props) as RefFromFields<MFieldMap>;
    this._fields = { ...propsObj };

    Object.keys(propsObj).forEach((fieldName) => {
      // In this case, we got a prop that wasn't defined as a field.
      // Assuming it's an arbitrary data field, making an instance-specific
      // descriptor for it.
      // Using the in operator as the property could be defined anywhere
      // on the prototype chain.
      if (!(fieldName in this)) {
        Object.defineProperty(this, fieldName, {
          get: () => this._fields[fieldName as keyof RefFromFields<MFieldMap>],
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
  static get session(): SessionWithBoundModels<AnySchema> {
    return this._session;
  }

  /**
   * Returns an instance of the model's `querySetClass` field.
   * By default, this will be an empty {@link QuerySet}.
   *
   * @return {Object} An instance of the model's `querySetClass`.
   */
  static getQuerySet<MClassType extends typeof AnyModel>(this: MClassType): QuerySet<MClassType> {
    const { querySetClass: QuerySetClass } = this;
    return new (castTo<QuerySetConstructor<MClassType>>(QuerySetClass))(this);
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
  static get query() {
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
  static create<
    MClassType extends typeof AnyModel, 
    TypeMapping extends { mapFrom: any; mapTo: any; } = AnyMappingType
  >(this: MClassType, userProps: MapTypes<RefWithFields<InstanceType<MClassType>>, TypeMapping>) {
    if (typeof this._session === "undefined") {
      throw new Error(
        [
          `Tried to create a ${this.modelName} model instance without a session. `,
          "Create a session using `session = orm.session()` and call ",
          `\`session["${this.modelName}"].create\` instead.`,
        ].join("")
      );
    }
    const props: Record<string, AnyModel | ModelId | null | (AnyModel | ModelId | null)[]> = { ...userProps };

    const m2mRelations: Record<string, (AnyModel | ModelId)[]> = {} as Record<string, (AnyModel | ModelId)[]>;
    const registry = ModelDescriptorsRegistry.getInstance();
    const descriptors = getDescriptors(registry, this);
    const declaredFieldNames = Object.keys(descriptors);
    const declaredVirtualFieldNames = Object.keys(this.virtualFields);

    declaredFieldNames.forEach((key) => {
      const field = descriptors[key];
      const valuePassed = userProps.hasOwnProperty(key);
      if (!(field instanceof ManyToMany)) {
        if (valuePassed) {
          const value = userProps[key as keyof RefWithFields<InstanceType<MClassType>>];
          if (typeof value === 'number' && (field instanceof ForeignKey || field instanceof OneToOne)) {
            props[key] = String(value);
          } else {
            props[key] = normalizeEntity(value);
          }
        } else if ((field as Attribute).getDefault) {
          props[key] = (field as any).getDefault();
        }
      } else if (valuePassed) {
        // If a value is supplied for a ManyToMany field,
        // discard them from props and save for later processing.
        m2mRelations[key] = (userProps[key as keyof RefWithFields<InstanceType<MClassType>>] as unknown) as (AnyModel | ModelId)[];
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
          m2mRelations[key] = (userProps[key as keyof RefWithFields<InstanceType<MClassType>>] as unknown) as (AnyModel | ModelId)[];
          delete props[key];
        }
      }
    });

    const newEntry = this.session.applyUpdate<InstanceType<MClassType>>({
      action: CREATE,
      table: this.modelName,
      payload: castTo<Ref<InstanceType<MClassType>>>(props),
    });

    const ThisModel = castTo<ModelConstructor<InstanceType<MClassType>>>(this);
    const instance = new ThisModel(newEntry);
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
  static upsert<
    MClassType extends typeof AnyModel, 
    TypeMapping extends { mapFrom: any; mapTo: any; } = AnyMappingType
  >(this: MClassType, userProps: MapTypes<RefWithFields<InstanceType<MClassType>>, TypeMapping>) {
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
      const id = (userProps[idAttribute as keyof RefWithFields<InstanceType<MClassType>>] as unknown) as string;
      if (this.idExists(id)) {
        const model = this.withId(id)!;
        castTo<any>(model).update(userProps);
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
  static withId<MClassType extends typeof AnyModel>(this: MClassType, id: ModelId): SessionBoundModel<InstanceType<MClassType>> | null {
    return this.get({
      [this.idAttribute]: id,
    } as unknown as Partial<Ref<InstanceType<MClassType>>>);
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
  static idExists(id?: ModelId): boolean {
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
  static exists<MClassType extends typeof AnyModel>(this: MClassType, lookupObj: Partial<Ref<InstanceType<MClassType>>>): boolean {
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
  static get<MClassType extends typeof AnyModel>(this: MClassType, lookupObj: Partial<Ref<InstanceType<MClassType>>>): SessionBoundModel<InstanceType<MClassType>> | null {
    const ThisModel = castTo<ModelConstructor<InstanceType<MClassType>>>(this);

    const rows = this._findDatabaseRows<InstanceType<MClassType>>(lookupObj);
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
  getClass(): MClassType {
    return this.constructor as MClassType;
  }

  /**
   * Gets the id value of the current instance by looking up the id attribute.
   * @return {*} The id value of the current instance.
   */
  getId(): ModelId {
    return this._fields[this.getClass().idAttribute as keyof RefFromFields<MFieldMap>] as ModelId;
  }

  /**
   * Returns a reference to the plain JS object in the store.
   * Make sure to not mutate this.
   *
   * @return {Object} a reference to the plain JS object in the store
   */
  //@ts-ignore
  get ref(): Ref<InstanceType<MClassType>> {
    const ThisModel = this.getClass();

    return ThisModel._findDatabaseRows<InstanceType<MClassType>>({
      [ThisModel.idAttribute as 'id']: this.getId(),
    } as Ref<InstanceType<MClassType>>)[0];
  }

  /**
   * Finds all rows in this model's table that match the given `lookupObj`.
   * If no `lookupObj` is passed, all rows in the model's table will be returned.
   *
   * @param  {*}  props - a key-value that {@link Model} instances should have to be considered as existing.
   * @return {Boolean} a boolean indicating if entity with `props` exists in the state
   * @private
   */
  static _findDatabaseRows<M extends AnyModel = AnyModel>(lookupObj: Partial<Ref<M>>): Ref<M>[] {
    const querySpec: Query<ModelClassMap, Partial<Ref<M>>> = {
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
    return this.session.query(querySpec).rows as Ref<M>[];
  }

  /**
   * Returns a string representation of the {@link Model} instance.
   *
   * @return {string} A string representation of this {@link Model} instance.
   */
  toString(): string {
    const ThisModel = this.getClass();
    const className = ThisModel.modelName;
    const registry = ModelDescriptorsRegistry.getInstance();
    const descriptors = getDescriptors(registry, ThisModel);
    const fieldNames = Object.keys(descriptors);
    const fields = fieldNames
      .map((fieldName) => {
        const field = descriptors[fieldName];
        if (field instanceof ManyToMany) {
          const ids: ModelId[] = (castTo<AnyObject>(this)[fieldName] as unknown as QuerySet<MClassType>)
            .toModelArray()
            .map(model => model.getId());
          return `${fieldName}: [${ids.join(", ")}]`;
        }
        const val = this._fields[fieldName as keyof RefFromFields<MFieldMap>];
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
  equals<OtherMClass extends typeof AnyModel = typeof AnyModel, OtherAttrs extends ModelFieldMap = ModelFieldMap>(otherModel: Model<OtherMClass, OtherAttrs>): boolean {
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
  update<M extends AnyModel = AnyModel, TypeMapping extends { mapFrom: any; mapTo: any; } = AnyMappingType>(this: M, userMergeObj: Partial<MapTypes<RefWithFields<M>, TypeMapping>>): void {
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

    const registry = ModelDescriptorsRegistry.getInstance();
    const descriptors = getDescriptors(registry, ThisModel);
    const { virtualFields } = ThisModel;

    const m2mRelations: Record<string, ModelId[]> = {} as Record<string, ModelId[]>;

    // If an array of entities or id's is supplied for a
    // many-to-many related field, clear the old relations
    // and add the new ones.
    for (const mergeKey in mergeObj) {
      // eslint-disable-line no-restricted-syntax, guard-for-in
      const isRealField = descriptors.hasOwnProperty(mergeKey);

      if (isRealField) {
        const field = descriptors[mergeKey];

        if (field instanceof ForeignKey || field instanceof OneToOne) {
          if (typeof mergeObj[mergeKey] === 'number') {
            mergeObj[mergeKey] = String(mergeObj[mergeKey]) as any;
          } else {
            // update one-one/fk relations
            mergeObj[mergeKey] = normalizeEntity(mergeObj[mergeKey] as M) as any;
          }
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
    } as Ref<M>;

    const updatedModel = new ThisModel(this._fields);
    updatedModel._initFields(mergedFields); // eslint-disable-line no-underscore-dangle

    // determine if model would have different related models after update
    updatedModel._refreshMany2Many(m2mRelations); // eslint-disable-line no-underscore-dangle
    const relationsEqual = Object.keys(m2mRelations).every(
      (name) =>
        !arrayDiffActions(
          (this as AnyObject)[name] as ModelId[],
          (updatedModel as AnyObject)[name] as ModelId[]
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
        payload: castTo<Ref<M>>(mergeObj),
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
    const { virtualFields, modelName } = ThisModel;
    const registry = ModelDescriptorsRegistry.getInstance();
    const descriptors = getDescriptors(registry, ThisModel);
    Object.keys(relations).forEach((name) => {
      const reverse = !descriptors.hasOwnProperty(name);
      const field = virtualFields[name];
      const values = relations[name];

      if (!Array.isArray(values)) {
        throw new TypeError(
          `Failed to resolve many-to-many relationship: ${modelName}[${name}] must be an array (passed: ${values})`
        );
      }

      const normalizedNewIds = values.map(val => {
        if (typeof val === 'number') {
          return String(val);
        }
        return normalizeEntity(val);
      });
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
        ({ from: fromField, to: toField } = field.throughFields as { from: string; to: string });
      } else {
        ({ from: toField, to: fromField } = field.throughFields as { from: string; to: string });
      }

      const currentIds = ThroughModel.filter(
        (through) =>
          through[fromField] === (this as AnyObject)[ThisModel.idAttribute]
      )
        .toRefArray()
        .map((ref) => castTo<ModelId>(ref[toField as keyof RefFromFields]));

      const diffActions = arrayDiffActions(currentIds, normalizedNewIds);

      if (diffActions) {
        const { delete: idsToDelete, add: idsToAdd } = diffActions;
        if (idsToDelete.length > 0) {
          (this as AnyObject)[name].remove(...idsToDelete);
        }
        if (idsToAdd.length > 0) {
          (this as AnyObject)[name].add(...idsToAdd);
        }
      }
    });
  }

  shouldCascadeDelete(field: RelationalField) {
    return field?.onDelete === 'CASCADE';
  }

  cascadeDelete(key: string): void {
    const field = (this as AnyObject)[key] as SessionBoundModel | QuerySet | null;
    field?.delete();
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
        const qs = (this as AnyObject)[key] as QuerySet;
        if (this.shouldCascadeDelete(field)) {
          this.cascadeDelete(key);
        }
        // Delete any many-to-many rows the entity is included in.
        qs.clear();
      } else if (field instanceof ForeignKey) {
        const relatedQs = (this as AnyObject)[key];
        if (relatedQs.exists()) {
          if (this.shouldCascadeDelete(field)) {
            this.cascadeDelete(key);
          }
          relatedQs.update({ [field.relatedName!]: null });
        }
      } else if (field instanceof OneToOne) {
        // Set null to any foreign keys or one to ones pointed to
        // this instance.
        if (this.shouldCascadeDelete(field)) {
          this.cascadeDelete(key);
        }
        if ((this as AnyObject)[key] !== null) {
          (this as AnyObject)[key][field.relatedName!] = null;
        }
      }
    }
  }

  static count(): number {
    return this.getQuerySet().count();
  }

  static at<MClassType extends typeof AnyModel>(this: MClassType, index: number): SessionBoundModel<InstanceType<MClassType>> | undefined {
    return this.getQuerySet().at(index);
  }

  static all<MClassType extends typeof AnyModel>(this: MClassType): QuerySet<MClassType> {
    return this.getQuerySet().all();
  }

  static first<MClassType extends typeof AnyModel>(this: MClassType): SessionBoundModel<InstanceType<MClassType>> | undefined {
    return this.getQuerySet().first();
  }

  static last<MClassType extends typeof AnyModel>(this: MClassType): SessionBoundModel<InstanceType<MClassType>> | undefined {
    return this.getQuerySet().last();
  }

  static filter<MClassType extends typeof AnyModel, TypeMapping extends { mapFrom: any; mapTo: any; } = AnyMappingType>(this: MClassType, lookupObj: Partial<MapTypes<RefWithFields<InstanceType<MClassType>>, TypeMapping>> | ((row: MapTypes<RefWithFields<InstanceType<MClassType>>, TypeMapping>) => boolean)): QuerySet<MClassType> {
    return this.getQuerySet().filter(lookupObj);
  }

  static exclude<MClassType extends typeof AnyModel, TypeMapping extends { mapFrom: any; mapTo: any; } = AnyMappingType>(this: MClassType, lookupObj: Partial<MapTypes<RefWithFields<InstanceType<MClassType>>, TypeMapping>> | ((row: MapTypes<RefWithFields<InstanceType<MClassType>>, TypeMapping>) => boolean)): QuerySet<MClassType> {
    return this.getQuerySet().exclude(lookupObj);
  }

  static orderBy<MClassType extends typeof AnyModel>(
    this: MClassType,
    iteratees: SortIteratee<InstanceType<MClassType>> | ReadonlyArray<SortIteratee<InstanceType<MClassType>>>,
    orders?: SortOrder | ReadonlyArray<SortOrder>
  ): QuerySet<MClassType> {
    return this.getQuerySet().orderBy(iteratees, orders);
  }

  static update<MClassType extends typeof AnyModel>(mergeObj: Partial<Ref<InstanceType<MClassType>>>): void {
    this.getQuerySet().update(mergeObj);
  }

  static delete(): void {
    return this.getQuerySet().delete();
  }
}

export class AnyModel extends Model {}

export type ModelClassMap = Record<string, typeof AnyModel>;
