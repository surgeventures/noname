import { BatchToken, getBatchToken } from "immutable-ops";
import Model, { ModelClassMap } from "./Model";

import { SUCCESS, UPDATE, DELETE } from "./constants";
import ORM from "./ORM";
import {
  Database,
  OrmState,
  Query,
  UpdateSpec,
  ModelId,
  TableRow,
  WithForEach,
  QueryClause,
  ObjectMap,
  ModelData,
} from "./types";
import { clauseFiltersByAttribute } from "./utils";
import { castTo } from "./hacks";

export default class Session {
  readonly schema: ORM;
  db: Database;
  state: OrmState;
  readonly initialState: OrmState;
  readonly withMutations: boolean;
  private readonly batchToken: BatchToken;
  private readonly modelData: ModelData;
  private readonly models: typeof Model[];
  sessionBoundModels: typeof Model[];

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
    schema: ORM,
    db: Database,
    state?: OrmState,
    withMutations: boolean = false,
    batchToken: BatchToken = null
  ) {
    this.schema = schema;
    this.db = db;
    this.state = state || db.getEmptyState();
    this.initialState = this.state;

    this.withMutations = !!withMutations;
    this.batchToken = batchToken || getBatchToken();

    this.modelData = {};

    this.models = schema.getModelClasses();

    this.sessionBoundModels = this.models.map((modelClass: typeof Model) => {
      function SessionBoundModel(): typeof Model {
        return Reflect.construct(
          modelClass,
          arguments,
          SessionBoundModel
        ) as typeof Model; // eslint-disable-line prefer-rest-params
      }
      Reflect.setPrototypeOf(SessionBoundModel.prototype, modelClass.prototype);
      Reflect.setPrototypeOf(SessionBoundModel, modelClass);

      Object.defineProperty(this, modelClass.modelName, {
        get: () => SessionBoundModel,
      });

      const result = castTo<typeof Model>(SessionBoundModel);
      result.connect(this);
      return result;
    });
  }

  getDataForModel(modelName: string) {
    if (!this.modelData[modelName]) {
      this.modelData[modelName] = {};
    }
    return this.modelData[modelName];
  }

  markAccessed(modelName: string, modelIds: WithForEach<ModelId>) {
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
        {}
      );
  }

  markFullTableScanned(modelName: string) {
    const data = this.getDataForModel(modelName);
    data.fullTableScanned = true;
  }

  get fullTableScannedModels() {
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
  applyUpdate(updateSpec: UpdateSpec) {
    const tx = this._getTransaction(updateSpec);
    const result = this.db.update(updateSpec, tx, this.state);
    const { status, state, payload } = result;

    if (status !== SUCCESS) {
      throw new Error(
        `Applying update failed with status ${status}. Payload: ${payload}`
      );
    }

    this.state = state;

    return payload;
  }

  query(querySpec: Query) {
    const result = this.db.query(querySpec, this.state);

    this._markAccessedByQuery(querySpec, result);

    return result;
  }

  _getTransaction(updateSpec: UpdateSpec) {
    const { withMutations } = this;
    const { action } = updateSpec;
    let { batchToken } = this;
    if ([UPDATE, DELETE].includes(action)) {
      batchToken = getBatchToken();
    }
    return { batchToken, withMutations };
  }

  _markAccessedByQuery(querySpec: Query, result: { rows: TableRow[] }) {
    const { table, clauses } = querySpec;
    const { rows } = result;

    const { idAttribute } = castTo<ModelClassMap>(this)[table];
    const accessedIds = new Set<ModelId>(
      rows.map((row: TableRow) => row[idAttribute])
    );

    const anyClauseFilteredById = clauses.some(
      (clause: QueryClause<ObjectMap<any>>) => {
        if (!clauseFiltersByAttribute(clause, idAttribute)) {
          return false;
        }
        /**
         * we previously knew which row we wanted to access,
         * so there was no need to scan the entire table
         */
        const id = clause.payload[idAttribute];
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
