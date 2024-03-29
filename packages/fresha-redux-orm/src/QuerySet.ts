import mapValues from "lodash/mapValues";
import { normalizeEntity } from "./utils";

import { UPDATE, DELETE, FILTER, EXCLUDE, ORDER_BY } from "./constants";
import { AnyModel } from "./Model";
import { ModelConstructor, ModelId, QueryClause, Ref, SortIteratee, SortOrder, QuerySetConstructor, RefWithFields, SessionBoundModel } from "./types";
import { castTo } from "./hacks";

/**
 * This class is used to build and make queries to the database
 * and operating the resulting set (such as updating attributes
 * or deleting the records).
 *
 * The queries are built lazily. For example:
 *
 * ```javascript
 * const qs = Book.all()
 *     .filter(book => book.releaseYear > 1999)
 *     .orderBy('name');
 * ```
 *
 * Doesn't execute a query. The query is executed only when
 * you need information from the query result, such as {@link QuerySet#count},
 * {@link QuerySet#toRefArray}. After the query is executed, the resulting
 * set is cached in the QuerySet instance.
 *
 * QuerySet instances also return copies, so chaining filters doesn't
 * mutate the previous instances.
 */
export default class QuerySet<MClassType extends typeof AnyModel = typeof AnyModel> {
  public modelClass: MClassType;
  private clauses: QueryClause[];
  rows: Ref<InstanceType<MClassType>>[];
  private _opts?: {};
  private _evaluated: boolean;

  /**
   * Creates a QuerySet. The constructor is mainly for internal use;
   * You should access QuerySet instances from {@link Model}.
   *
   * @param  {Model} modelClass - the model class of objects in this QuerySet.
   * @param  {any[]} clauses - query clauses needed to evaluate the set.
   * @param {Object} [opts] - additional options
   */
  constructor(modelClass: MClassType, clauses?: QueryClause[], opts?: {}) {
    this.modelClass = modelClass;
    this.clauses = clauses || [];
    this._opts = opts;
  }

  _new<Payload extends object>(clauses: QueryClause<Payload>[], userOpts?: {}): QuerySet<MClassType> {
    const opts = Object.assign({}, this._opts, userOpts);
    return new (castTo<QuerySetConstructor<MClassType, Payload>>(this.constructor))(
      this.modelClass,
      clauses,
      opts
    );
  }

  toString(): string {
    this._evaluate();
    const contents = this.rows
      .map(({ id }) => this.modelClass.withId<typeof AnyModel>(id!)!.toString())
      .join("\n    - ");
    return `QuerySet contents:\n    - ${contents}`;
  }

  /**
   * Returns an array of the plain objects represented by the QuerySet.
   * The plain objects are direct references to the store.
   *
   * @return {Object[]} references to the plain JS objects represented by
   *                    the QuerySet
   */
  toRefArray(): Ref<InstanceType<MClassType>>[] {
    return this._evaluate();
  }

  /**
   * Returns an array of {@link Model} instances represented by the QuerySet.
   * @return {Model[]} model instances represented by the QuerySet
   */
  toModelArray(): SessionBoundModel<InstanceType<MClassType>>[] {
    const { modelClass } = this;
    return this._evaluate().map((props) => {
      const ModelClass = castTo<ModelConstructor<InstanceType<MClassType>>>(modelClass);
      return new ModelClass(props);
    });
  }

  /**
   * Returns the number of {@link Model} instances represented by the QuerySet.
   *
   * @return {number} length of the QuerySet
   */
  count(): number {
    this._evaluate();
    return this.rows.length;
  }

  /**
   * Checks if the {@link QuerySet} instance has any records matching the query
   * in the database.
   *
   * @return {Boolean} `true` if the {@link QuerySet} instance contains entities, else `false`.
   */
  exists(): boolean {
    return Boolean(this.count());
  }

  /**
   * Returns the {@link Model} instance at index `index` in the {@link QuerySet} instance if
   * `withRefs` flag is set to `false`, or a reference to the plain JavaScript
   * object in the model state if `true`.
   *
   * @param  {number} index - index of the model instance to get
   * @return {Model|undefined} a {@link Model} instance at index
   *                           `index` in the {@link QuerySet} instance,
   *                           or undefined if the index is out of bounds.
   */
  at(index: number): SessionBoundModel<InstanceType<MClassType>> | undefined {
    const { modelClass } = this;

    const rows = this._evaluate();
    if (index >= 0 && index < rows.length) {
      const ModelClass = castTo<ModelConstructor<InstanceType<MClassType>>>(modelClass);
      return new ModelClass(rows[index]);
    }

    return undefined;
  }

  /**
   * Returns the {@link Model} instance at index 0 in the {@link QuerySet} instance.
   * @return {Model}
   */
  first(): SessionBoundModel<InstanceType<MClassType>> | undefined {
    return this.at(0);
  }

  /**
   * Returns the {@link Model} instance at index `QuerySet.count() - 1`
   * @return {Model}
   */
  last(): SessionBoundModel<InstanceType<MClassType>> | undefined {
    const rows = this._evaluate();
    return this.at(rows.length - 1);
  }

  /**
   * Returns a new {@link QuerySet} instance with the same entities.
   * @return {QuerySet} a new QuerySet with the same entities.
   */
  all(): QuerySet<MClassType> {
    return this._new(this.clauses);
  }

  /**
   * Returns a new {@link QuerySet} instance with entities that match properties in `lookupObj`.
   *
   * @param  {Object} lookupObj - the properties to match objects with. Can also be a function.
   * @return {QuerySet} a new {@link QuerySet} instance with objects that passed the filter.
   */
  filter(lookupObj: Partial<RefWithFields<InstanceType<MClassType>>> | ((row: RefWithFields<InstanceType<MClassType>>) => boolean)): QuerySet<MClassType> {
    /**
     * allow foreign keys to be specified as model instances,
     * transform model instances to their primary keys
     */
    const normalizedLookupObj =
      typeof lookupObj === "object"
        ? mapValues(lookupObj, normalizeEntity)
        : lookupObj;

    const filterDescriptor = {
      type: FILTER,
      payload: normalizedLookupObj,
    } as const;
    /**
     * create a new QuerySet
     * including only rows matching the lookupObj
     */
    return this._new(this.clauses.concat(filterDescriptor));
  }

  /**
   * Returns a new {@link QuerySet} instance with entities that do not match
   * properties in `lookupObj`.
   *
   * @param  {Object} lookupObj - the properties to unmatch objects with. Can also be a function.
   * @return {QuerySet} a new {@link QuerySet} instance with objects that did not pass the filter.
   */
  exclude(lookupObj: Partial<RefWithFields<InstanceType<MClassType>>> | ((row: RefWithFields<InstanceType<MClassType>>) => boolean)): QuerySet<MClassType> {
    /**
     * allow foreign keys to be specified as model instances,
     * transform model instances to their primary keys
     */
    const normalizedLookupObj =
      typeof lookupObj === "object"
        ? mapValues(lookupObj, normalizeEntity)
        : lookupObj;
    const excludeDescriptor = {
      type: EXCLUDE,
      payload: normalizedLookupObj,
    } as const;

    /**
     * create a new QuerySet
     * excluding all rows matching the lookupObj
     */
    return this._new(this.clauses.concat(excludeDescriptor));
  }

  /**
   * Performs the actual database query.
   * @private
   * @return {Array} rows corresponding to the QuerySet's clauses
   */
  _evaluate(): Ref<InstanceType<MClassType>>[] {
    if (typeof this.modelClass.session === "undefined") {
      throw new Error(
        [
          `Tried to query the ${this.modelClass.modelName} model's table without a session. `,
          "Create a session using `session = orm.session()` and use ",
          `\`session["${this.modelClass.modelName}"]\` for querying instead.`,
        ].join("")
      );
    }
    if (!this._evaluated) {
      const { session, modelName: table } = this.modelClass;
      const querySpec = {
        table,
        clauses: this.clauses,
      };
      this.rows = session.query(querySpec).rows as Ref<InstanceType<MClassType>>[];
      this._evaluated = true;
    }
    return this.rows;
  }

  /**
   * Returns a new {@link QuerySet} instance with entities ordered by `iteratees` in ascending
   * order, unless otherwise specified. Delegates to `lodash.orderBy`.
   *
   * @param  {string[]|Function[]} iteratees - an array where each item can be a string or a
   *                                           function. If a string is supplied, it should
   *                                           correspond to property on the entity that will
   *                                           determine the order. If a function is supplied,
   *                                           it should return the value to order by.
   * @param {Boolean[]} [orders] - the sort orders of `iteratees`. If unspecified, all iteratees
   *                               will be sorted in ascending order. `true` and `'asc'`
   *                               correspond to ascending order, and `false` and `'desc`
   *                               to descending order.
   * @return {QuerySet} a new {@link QuerySet} with objects ordered by `iteratees`.
   */
  orderBy(
    iteratees: SortIteratee<InstanceType<MClassType>> | ReadonlyArray<SortIteratee<InstanceType<MClassType>>>,
    orders?: SortOrder | ReadonlyArray<SortOrder>
  ): QuerySet<MClassType>
 {
    const orderByDescriptor = {
      type: ORDER_BY,
      payload: [iteratees, orders],
    } as const;

    /**
     * create a new QuerySet
     * sorting all rows according to the passed arguments
     */
    return this._new(this.clauses.concat(orderByDescriptor));
  }

  /**
   * Records an update specified with `mergeObj` to all the objects
   * in the {@link QuerySet} instance.
   *
   * @param  {Object} mergeObj - an object to merge with all the objects in this
   *                             queryset.
   * @return {undefined}
   */
  update(mergeObj: Partial<Ref<InstanceType<MClassType>>>): void {
    const { session, modelName: table } = this.modelClass;

    session.applyUpdate({
      action: UPDATE,
      query: {
        table,
        clauses: this.clauses,
      },
      payload: mergeObj,
    });

    this._evaluated = false;
  }

  /**
   * Records a deletion of all the objects in this {@link QuerySet} instance.
   * @return {undefined}
   */
  delete(): void {
    const { session, modelName: table } = this.modelClass;

    this.toModelArray().forEach(
      (model) => model._onDelete()
    );

    session.applyUpdate({
      action: DELETE,
      query: {
        table,
        clauses: this.clauses,
      },
    });

    this._evaluated = false;
  }

  add: <QSet extends QuerySet>(this: QSet, ...entities: (ModelId | (QSet extends QuerySet<infer MClassType> ? SessionBoundModel<InstanceType<MClassType>> : never))[]) => void;
  remove: <QSet extends QuerySet>(this: QSet, ...entities: (ModelId | (QSet extends QuerySet<infer MClassType> ? SessionBoundModel<InstanceType<MClassType>> : never))[]) => void;
  clear: () => void;
}
