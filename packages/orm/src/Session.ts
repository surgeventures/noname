import { BatchToken, getBatchToken } from "immutable-ops";
import { AnyModel, ModelClassMap} from "./Model";

import { SUCCESS, UPDATE, DELETE } from "./constants";
import ORM from "./ORM";
import {
  Database,
  OrmState,
  Query,
  UpdateSpec,
  ModelId,
  Ref
} from "./types";
import { clauseFiltersByAttribute } from "./utils";
import { castTo } from "./hacks";

type WithForEach<T> = {
  forEach: (cb: {
    (elem: T): void;
  }) => void;
}

type Data = { accessedInstances: Record<ModelId, boolean>, fullTableScanned: boolean };
type ModelData<Schema extends ModelClassMap> = Record<keyof Schema, Data>

export default class Session<Schema extends ModelClassMap = ModelClassMap> {
  readonly schema: ORM<Schema>;
  db: Database<Schema>;
  state: OrmState<Schema>;
  readonly initialState: OrmState<Schema>;
  readonly withMutations: boolean;
  private readonly batchToken: BatchToken;
  private readonly modelData: ModelData<Schema>;
  private readonly models: Schema[keyof Schema][];
  sessionBoundModels: Schema[keyof Schema][];

  /**
   * Creates a new Session.
   *
   * @param  {Database} db - a {@link Database} instance
   * @param  {Object} state - the database state
   * @param  {Boolean} [withMutations] - whether the session should mutate data
   * @param  {Object} [batchToken] - used by the backend to identify objects that can be
   *                                 mutated.
   */
  constructor(
    schema: ORM<Schema>,
    db: Database<Schema>,
    state?: OrmState<Schema>,
    withMutations: boolean = false,
    batchToken: BatchToken = null
  ) {
    this.schema = schema;
    this.db = db;
    this.state = state || db.getEmptyState();
    this.initialState = this.state;

    this.withMutations = !!withMutations;
    this.batchToken = batchToken || getBatchToken();

    this.modelData = {} as ModelData<Schema>;

    this.models = schema.getModelClasses();

    this.sessionBoundModels = this.models.map((modelClass) => {
      function SessionBoundModel(): Schema[keyof Schema] {
        return Reflect.construct(
          modelClass,
          arguments,
          SessionBoundModel
        );
      }
      Reflect.setPrototypeOf(SessionBoundModel.prototype, modelClass.prototype);
      Reflect.setPrototypeOf(SessionBoundModel, modelClass);

      Object.defineProperty(this, modelClass.modelName, {
        get: () => SessionBoundModel,
      });

      const result = castTo<Schema[keyof Schema]>(SessionBoundModel);
      result.connect(this);
      return result;
    });
  }

  getDataForModel(modelName: keyof Schema) {
    if (!this.modelData[modelName]) {
      this.modelData[modelName] = {} as Data;
    }
    return this.modelData[modelName];
  }

  markAccessed(modelName: keyof Schema, modelIds: WithForEach<ModelId>) {
    const data = this.getDataForModel(modelName);
    if (!data.accessedInstances) {
      data.accessedInstances = {};
    }
    modelIds.forEach((id) => {
      data.accessedInstances[id] = true;
    });
  }

  get accessedModelInstances() {
    return this.sessionBoundModels
      .filter(
        ({ modelName }) => !!this.getDataForModel(modelName).accessedInstances
      )
      .reduce(
        (result, { modelName }) => ({
          ...result,
          [modelName]: this.getDataForModel(modelName).accessedInstances,
        }),
        {} as Record<keyof Schema, Data['accessedInstances']>
      );
  }

  markFullTableScanned(modelName: keyof Schema) {
    const data = this.getDataForModel(modelName);
    data.fullTableScanned = true;
  }

  get fullTableScannedModels(): (keyof Schema)[] {
    return this.sessionBoundModels
      .filter(
        ({ modelName }) => !!this.getDataForModel(modelName).fullTableScanned
      )
      .map(({ modelName }) => modelName);
  }

  /**
   * Applies update to a model state.
   *
   * @private
   * @param {Object} update - the update object. Must have keys
   *                          `type`, `payload`.
   */
  applyUpdate<MClass extends AnyModel>(updateSpec: UpdateSpec<Schema, Partial<Ref<MClass>>>): Ref<MClass> {
    const tx = this._getTransaction(updateSpec);
    const result = this.db.update<Ref<MClass>>(updateSpec, tx, this.state);
    const { status, state, payload } = result;

    if (status !== SUCCESS) {
      throw new Error(
        `Applying update failed with status ${status}. Payload: ${payload}`
      );
    }

    this.state = state;

    return payload;
  }

  query(querySpec: Query<Schema>): {
    rows: Ref<InstanceType<Schema[keyof Schema]>>[];
} {
    const result = this.db.query(querySpec, this.state);

    this._markAccessedByQuery(querySpec, result);

    return result;
  }

  _getTransaction(updateSpec: UpdateSpec<Schema>) {
    const { withMutations } = this;
    const { action } = updateSpec;
    let { batchToken } = this;
    if ([UPDATE, DELETE].includes(action)) {
      batchToken = getBatchToken();
    }
    return { batchToken, withMutations };
  }

  _markAccessedByQuery(querySpec: Query<Schema, Record<string, ModelId>>, result: { rows: Ref<InstanceType<Schema[keyof Schema]>>[] }) {
    const { table, clauses } = querySpec;
    const { rows } = result;

    const { idAttribute } = castTo<Schema>(this)[table];
    const accessedIds = new Set<ModelId>(
      rows.map((row) => castTo<any>(row)[idAttribute] as ModelId)
    );

    const anyClauseFilteredById = clauses.some(
      (clause) => {
        if (!clauseFiltersByAttribute(clause, idAttribute)) {
          return false;
        }
        /**
         * we previously knew which row we wanted to access,
         * so there was no need to scan the entire table
         */
        const id = clause.payload![idAttribute];
        accessedIds.add(id);
        return true;
      }
    );

    if (anyClauseFilteredById) {
      /**
       * clauses have been ordered so that an indexed one was
       * the first to be evaluated, and thus only the row
       * with the specified id has actually been accessed
       */
      this.markAccessed(table, accessedIds);
    } else {
      /**
       * any other clause would have caused a full table scan,
       * even if we specified an empty clauses array
       */
      this.markFullTableScanned(table);
    }
  }
}
