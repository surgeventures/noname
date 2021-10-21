import Session from "./Session";
import Model, { AnyModel, ModelClassMap } from "./Model";
import { createDatabase as defaultCreateDatabase } from "./db";
import { ForeignKey, ManyToMany, attr, Field } from "./fields";

import { Values, m2mName, m2mToFieldName, m2mFromFieldName } from "./utils";
import { DatabaseCreator } from "./db/Database";
import { Database, OrmState, SessionWithBoundModels } from "./types";
import { castTo } from "./hacks";
import { ModelDescriptorsRegistry } from "./ModelDescriptorsRegistry";

/**
 * ORM instantiation opts.
 *
 * Enables customization of database creation.
 */
export type ORMOpts<Schema extends ModelClassMap> = {
  createDatabase: DatabaseCreator<Schema>;
};

const ORM_DEFAULTS = {
  createDatabase: defaultCreateDatabase,
};

/**
 * ORM - the Object Relational Mapper.
 *
 * Use instances of this class to:
 *
 * - Register your {@link Model} classes using {@link ORM#register}
 * - Get the empty state for the underlying database with {@link ORM#getEmptyState}
 * - Start an immutable database session with {@link ORM#session}
 * - Start a mutating database session with {@link ORM#mutableSession}
 *
 * Internally, this class handles generating a schema specification from models
 * to the database.
 */
export default class ORM<
  Schema extends ModelClassMap,
> {
  private readonly createDatabase: DatabaseCreator<Schema>;
  readonly registry: Values<Schema>[];
  readonly implicitThroughModels: typeof AnyModel[];
  private readonly installedFields: Record<string, Record<string, boolean>>;
  private db: Database<Schema>;

  /**
   * Creates a new ORM instance.
   */
  constructor(opts?: ORMOpts<Schema>) {
    const { createDatabase } = Object.assign({}, ORM_DEFAULTS, opts || {});
    this.createDatabase = createDatabase;
    this.registry = [];
    this.implicitThroughModels = [];
    this.installedFields = {};
  }

  /**
   * Registers a {@link Model} class to the ORM.
   *
   * If the model has declared any ManyToMany fields, their
   * through models will be generated and registered with
   * this call, unless a custom through model has been specified.
   *
   * @param  {...Model} model - a {@link Model} class to register
   * @return {undefined}
   */
  register(...models: ReadonlyArray<Values<Schema>>) {
    models.forEach((model) => {
      if (model.modelName === undefined) {
        throw new Error("A model was passed that doesn't have a modelName set");
      }

      model.invalidateClassCache();

      this.registerManyToManyModelsFor(model);
      this.registry.push(model);
    });
  }

  registerManyToManyModelsFor(model: Values<Schema>) {
    const thisModelName = model.modelName;
    const registry = ModelDescriptorsRegistry.getInstance();
    const descriptors = registry.getDescriptors(thisModelName);
    Object.entries(descriptors).forEach(([fieldName, fieldInstance]) => {
      if (!(fieldInstance instanceof ManyToMany)) {
        return;
      }

      let toModelName;
      if (fieldInstance.toModelName === "this") {
        toModelName = thisModelName;
      } else {
        toModelName = fieldInstance.toModelName; // eslint-disable-line prefer-destructuring
      }

      const selfReferencing = thisModelName === toModelName;
      const fromFieldName = m2mFromFieldName(thisModelName);
      const toFieldName = m2mToFieldName(toModelName);

      if (fieldInstance.through) {
        if (selfReferencing && !fieldInstance.throughFields) {
          throw new Error(
            "Self-referencing many-to-many relationship at " +
              `"${thisModelName}.${fieldName}" using custom ` +
              `model "${fieldInstance.through}" has no ` +
              "throughFields key. Cannot determine which " +
              "fields reference the instances partaking " +
              "in the relationship."
          );
        }
      } else {
        const Through = class ThroughModel extends Model {};

        Through.modelName = m2mName(thisModelName, fieldName);

        const PlainForeignKey = class ThroughForeignKeyField extends ForeignKey {
          get installsBackwardsVirtualField() {
            return false;
          }

          get installsBackwardsDescriptor() {
            return false;
          }
        };
        const ForeignKeyClass = selfReferencing ? PlainForeignKey : ForeignKey;
        registry.add(Through.modelName, {
          id: attr(),
          [fromFieldName]: new ForeignKeyClass(thisModelName),
          [toFieldName]: new ForeignKeyClass(toModelName),
        });

        Through.invalidateClassCache();
        this.implicitThroughModels.push(Through);
      }
    });
  }

  /**
   * Gets a {@link Model} class by its name from the registry.
   * @param  {string} modelName - the name of the {@link Model} class to get
   * @throws If {@link Model} class is not found.
   * @return {Model} the {@link Model} class, if found
   */
  get<K extends keyof Schema>(modelName: K): Schema[K] {
    const allModels = this.registry.concat(this.implicitThroughModels as any) as Schema[K][] & AnyModel[];
    const found = Object.values(allModels).find(
      (model) => model.modelName === modelName
    );

    if (typeof found === "undefined") {
      throw new Error(`Did not find model ${modelName} from registry.`);
    }
    return found as Schema[K];
  }

  getModelClasses() {
    this._setupModelPrototypes(this.registry);
    this._setupModelPrototypes(this.implicitThroughModels);
    return this.registry.concat(this.implicitThroughModels as Values<Schema>[]);
  }

  generateSchemaSpec() {
    const models = this.getModelClasses();
    const tables = models.reduce<Schema>((spec, modelClass) => {
      const tableName = modelClass.modelName;
      const tableSpec = modelClass._getTableOpts();
      const registry = ModelDescriptorsRegistry.getInstance();
      const descriptors = registry.getDescriptors(tableName);
      spec[tableName as keyof Schema] = Object.assign(
        {},
        { fields: descriptors },
        tableSpec
      ) as unknown as Values<Schema>;
      return spec;
    }, {} as Schema);
    return { tables };
  }

  getDatabase() {
    if (!this.db) {
      this.db = this.createDatabase(this.generateSchemaSpec());
    }
    return this.db;
  }

  /**
   * Returns the empty database state.
   * @return {Object} the empty state
   */
  getEmptyState() {
    return this.getDatabase().getEmptyState();
  }

  /**
   * Begins an immutable database session.
   *
   * @param  {Object} state  - the state the database manages
   * @return {Session} a new {@link Session} instance
   */
  session(state?: OrmState<Schema>): SessionWithBoundModels<Schema> {
    return new Session(this, this.getDatabase(), state) as SessionWithBoundModels<Schema>;
  }

  /**
   * Begins a mutable database session.
   *
   * @param  {Object} state  - the state the database manages
   * @return {Session} a new {@link Session} instance
   */
  mutableSession(state?: OrmState<Schema>): SessionWithBoundModels<Schema> {
    return new Session(this, this.getDatabase(), state, true) as SessionWithBoundModels<Schema>;
  }

  /**
   * @private
   */
  _setupModelPrototypes<Models extends typeof AnyModel[]>(models: Models) {
    const registry = ModelDescriptorsRegistry.getInstance();

    models.forEach((model) => {
      if (!model.isSetUp) {
        const { modelName } = model;
        const descriptors = registry.getDescriptors(modelName);
        Object.entries(descriptors).forEach(([fieldName, field]) => {
          if (!this._isFieldInstalled(modelName, fieldName)) {
            this._installField(field, fieldName, model);
            this._setFieldInstalled(modelName, fieldName);
          }
        });
        model.isSetUp = true;
      }
    });
  }

  /**
   * @private
   */
  _isFieldInstalled(modelName: string, fieldName: string) {
    return this.installedFields.hasOwnProperty(modelName)
      ? !!this.installedFields[modelName][fieldName]
      : false;
  }

  /**
   * @private
   */
  _setFieldInstalled(modelName: string, fieldName: string) {
    if (!this.installedFields.hasOwnProperty(modelName)) {
      this.installedFields[modelName] = {};
    }
    this.installedFields[modelName][fieldName] = true;
  }

  /**
   * Installs a field on a model and its related models if necessary.
   * @private
   */
  _installField(field: Field, fieldName: string, model: typeof AnyModel) {
    const FieldInstaller = field.installerClass;
    new FieldInstaller({
      field,
      fieldName,
      model,
      orm: castTo<ORM<ModelClassMap>>(this),
    }).run();
  }
}
