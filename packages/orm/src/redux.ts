import { Session } from ".";
import { ModelClassMap } from './Model';

import { memoize } from "./memoize";
import ORM from "./ORM";
import { OrmState, OrmSelector, Selector, ReduxAction, Ref } from "./types";

/**
 * @module redux
 */

/**
 * Calls all models' reducers if they exist.
 * @return {undefined}
 */
export function defaultUpdater<Schema extends ModelClassMap>(session: Session<Schema>, action: ReduxAction<Ref<InstanceType<Schema[keyof Schema]>>>) {
  session.sessionBoundModels.forEach((modelClass) => {
    if (typeof modelClass.reducer === "function") {
      // This calls this.applyUpdate to update this.state
      modelClass.reducer(action, modelClass, session);
    }
  });
}

/**
 * Call the returned function to pass actions to Redux-ORM.
 *
 * @global
 *
 * @param {ORM} orm - the ORM instance.
 * @param {Function} [updater] - the function updating the ORM state based on the given action.
 * @return {Function} reducer that will update the ORM state.
 */
export function createReducer<Schema extends ModelClassMap>(orm: ORM<Schema>, updater = defaultUpdater) {
  return (state: OrmState<Schema> | undefined, action: ReduxAction<Ref<InstanceType<Schema[keyof Schema]>>>): OrmState<Schema> => {
    const session = orm.session(state || orm.getEmptyState());
    updater<Schema>(session, action);
    return session.state;
  };
}

/**
 * Returns a memoized selector based on passed arguments.
 * This is similar to `reselect`'s `createSelector`,
 * except you can also pass a single function to be memoized.
 *
 * If you pass multiple functions, the format will be the
 * same as in `reselect`. The last argument is the selector
 * function and the previous are input selectors.
 *
 * When you use this method to create a selector, the returned selector
 * expects the whole `redux-orm` state branch as input. In the selector
 * function that you pass as the last argument, you will receive a
 * `session` argument (a `Session` instance) followed by any
 * input arguments, like in `reselect`.
 *
 * This is an example selector:
 *
 * ```javascript
 * // orm is an instance of ORM
 * const bookSelector = createSelector(orm, session => {
 *     return session.Book.map(book => {
 *         return Object.assign({}, book.ref, {
 *             authors: book.authors.map(author => author.name),
 *             genres: book.genres.map(genre => genre.name),
 *         });
 *     });
 * });
 * ```
 *
 * redux-orm uses a special memoization function to avoid recomputations.
 *
 * Everytime a selector runs, this function records which instances
 * of your `Model`s were accessed.<br>
 * On subsequent runs, the selector first checks if the previously
 * accessed instances or `args` have changed in any way:
 * <ul>
 *     <li>If yes, the selector calls the function you passed to it.</li>
 *     <li>If not, it just returns the previous result
 *         (unless you call it for the first time).</li>
 * </ul>
 *
 * This way you can use the `PureRenderMixin` in your React components
 * for performance gains.
 *
 * @global
 *
 * @param {ORM} orm - the ORM instance
 * @param  {...Function} args - zero or more input selectors
 *                              and the selector function.
 * @return {Function} memoized selector
 */
export function createSelector<
Result,
Schema extends ModelClassMap = any,
O extends ORM<Schema> = ORM<Schema>,
Args extends unknown[] = []
>(
  orm: O,
  ormStateSelector: OrmSelector<O extends ORM<infer S> ? S : never, Result, Args>,
): Selector<O extends ORM<infer S> ? S : never, Result, Args> {
  return memoize(ormStateSelector, undefined, orm);
}
