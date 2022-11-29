import assert from 'assert';
import { EventEmitter } from 'events';

import type { AnyAction, Dispatch } from 'redux';
import { createAction } from 'redux-actions';
import { camelCase, JSONObject, JSONValue, snakeCase } from '@fresha/noname-core';

import type {
  APIActionCacheBody,
  APIActionMap,
  APICache,
  APICaller,
  APICallerResponse,
  APICommonConfig,
  APIConfig,
  APIEntryCache,
  APIEntryConfig,
  APIEnvironmentOptions,
  ConfigureAPIActionMap,
  APIOperationTemplateOptions,
  paramsType,
  APIAction,
} from './types';

import { createApiCaller } from './call';
import parseOperation from './operations';

const RAW_API_ORM_UPDATE = 'RAW_API_ORM_UPDATE';
const rawApiOrmUpdate = createAction(RAW_API_ORM_UPDATE);

const JSON_API_ORM_UPDATE = 'JSON_API_ORM_UPDATE';
export const jsonApiOrmUpdate = createAction<JSONValue, { type: string }>(
  JSON_API_ORM_UPDATE,
  (response: JSONValue, options: JSONObject, params: string[]) => ({
    response,
    options,
    params,
  }),
  () => ({ type: JSON_API_ORM_UPDATE }),
);

export enum UserEvents {
  Authenticated = 'user-authenticated',
  LogoutOnUnauthorized = 'user-logout-unauthorized',
}

const API_ADAPTERS = {
  raw: rawApiOrmUpdate,
  jsonapi: jsonApiOrmUpdate,
};

let requestPromise: Promise<void | APICallerResponse> | null = null;

export type OfflineHandlerFunc = () => void;

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop: () => void = () => {};

let apiBasePath = '';
let eventBus: EventEmitter;
let offlineHandler: OfflineHandlerFunc = noop;
let logoutAction: () => AnyAction;

export function init(
  { API_URL }: APIEnvironmentOptions,
  AppContextEventBus: EventEmitter,
  offlineHandlerFn: OfflineHandlerFunc,
  logoutActionFn: () => AnyAction,
): void {
  apiBasePath = `${API_URL}/session`;
  eventBus = AppContextEventBus;
  offlineHandler = offlineHandlerFn;
  logoutAction = logoutActionFn;
}

/**
 * If the request was unauthorized check that the user
 * is logged in by doing a GET /session request.
 * If that user is not authenticated, then redirect to login page
 * (location.replace causes a whole page reload which clears the store).
 */
function redirectToSignInIfUnauthorized(
  dispatch: Dispatch,
): Promise<void | APICallerResponse> | null {
  const caller = createApiCaller({ adapter: 'jsonapi' }) as APICaller;
  if (!requestPromise) {
    requestPromise = caller(apiBasePath, { httpMethod: 'get' })
      .catch((e: Response) => {
        if (e.status === 401) {
          eventBus.emit(UserEvents.LogoutOnUnauthorized);
          dispatch(logoutAction());
        } else {
          throw e;
        }
      })
      .finally(() => {
        requestPromise = null;
      });
  }

  return requestPromise;
}

function clearCache(entryCache: APICache, keys: string[]): void {
  const cacheKeyList = keys.includes('*') ? Object.keys(entryCache) : keys;

  cacheKeyList.forEach((k) => {
    // entryCache[k] is a list of caches for `read`, `list` and `single-read` operations
    entryCache[k].forEach((c) => c.clear());
  });
}

const handleOffline = (error: Response, ignoreOffline: boolean) => {
  if (!global.navigator.onLine && error && !error.status && !ignoreOffline) {
    offlineHandler();
  }
};

export function configureActions(
  entryKey: string,
  entryConfig: APIEntryConfig,
  commonConfig: APICommonConfig,
  { apiCaller, entryCache }: { apiCaller: APICaller; entryCache: APICache },
): ConfigureAPIActionMap {
  const apiAdapter = Array.isArray(commonConfig.adapter)
    ? commonConfig.adapter[1]
    : API_ADAPTERS[commonConfig.adapter];
  assert(apiAdapter, `Unsupported API adapter ${String(commonConfig.adapter)}`);

  const invalidateCacheKeys = [entryKey, ...(entryConfig.invalidatesCacheFor || [])];
  const actionCacheList: APIEntryCache = [];

  const result = {};
  Object.defineProperty(result, 'actionCacheList', {
    enumerable: false, // we do not want this to be treated as action
    value: actionCacheList,
  });

  entryConfig.operations.reduce<ConfigureAPIActionMap>((memo, op) => {
    const operation = parseOperation(op) as APIOperationTemplateOptions;

    const actionName = camelCase(
      typeof operation.actionName === 'function'
        ? operation.actionName(entryKey)
        : operation.actionName || entryKey,
    );
    assert(actionName, `Invalid action method name ${actionName}`);
    assert(!memo[actionName], `Duplicate action ${actionName}`);

    const actionType = snakeCase(actionName);
    const ormUpdateActionType = `${actionType}_orm_update`.toUpperCase();

    const actionCache = operation.cache ? new Map<string, APIActionCacheBody>() : null;
    if (actionCache) {
      actionCacheList.push(actionCache);
    }

    // eslint-disable-next-line arrow-body-style
    const actionFunc = (...params: paramsType[]) => {
      return (dispatch: Dispatch) => {
        // const apiUrl = operation.makeUrl(params, operation, entryConfig, commonConfig); // TODO: Bring back after gloo migration
        const apiUrl = operation.makeUrl(params, operation, entryConfig, commonConfig);
        const apiParams = operation.makeApiParams(params, entryConfig);
        const paramsObject = params.find((param) => typeof param === 'object') as JSONValue;
        const shouldUpdateStore = (paramsObject as { updateStore?: boolean })?.updateStore || true;
        let cacheKey: string | null = null;
        if (actionCache) {
          cacheKey = operation.cache?.makeKey(actionName, apiUrl, apiParams) as string;
          const cacheEntry = actionCache.get(cacheKey);
          if (cacheEntry) {
            const { promise, response, timestamp } = cacheEntry;
            if (promise) {
              return promise;
            }
            if (timestamp && Date.now() >= timestamp) {
              actionCache.delete(cacheKey);
            } else {
              return Promise.resolve({
                ...(response as JSONObject),
                fromCache: true,
              });
            }
          }
        }

        const promise = new Promise<JSONValue>(
          (resolve, reject, onCancel?: (callback: () => void) => void) => {
            const apiPromise = apiCaller(apiUrl, apiParams) as Promise<APICallerResponse> & {
              cancel: () => void;
            };

            apiPromise
              .then((response) => {
                if (operation.expireCache) {
                  clearCache(entryCache, invalidateCacheKeys);
                } else if (cacheKey !== null) {
                  actionCache?.set(cacheKey, {
                    promise: null,
                    response,
                    timestamp: Date.now() + 1000 * (operation.cache?.expirationTime || 0),
                  });
                }

                if (shouldUpdateStore) {
                  const updateAction = apiAdapter(response.body, operation, params as string[]);

                  if ((updateAction as { meta?: { type?: string } }).meta?.type) {
                    updateAction.type = ormUpdateActionType;
                  }

                  dispatch(updateAction);
                }

                resolve({
                  ...response,
                  _actionOptions: operation as unknown as JSONValue,
                  _actionParams: params,
                });
              })
              .catch((error: Response) => {
                if (cacheKey !== null) {
                  actionCache?.delete(cacheKey);
                }

                handleOffline(error, operation.ignoreOffline);
                // If the request was unauthorized check that the user is logged in
                if (error.status === 401 && !operation.noRedirectOnUnauthorized) {
                  redirectToSignInIfUnauthorized(dispatch)?.catch(() => reject(error));
                } else {
                  reject(error);
                }
              });

            if (onCancel) {
              onCancel(() => {
                if (cacheKey !== null) {
                  actionCache?.delete(cacheKey);
                }

                apiPromise.cancel();
              });
            }
          },
        );

        if (cacheKey !== null) {
          if ((actionCache?.size || 0) >= (operation.cache?.size || 0)) {
            actionCache?.delete(actionCache?.keys().next().value);
          }

          actionCache?.set(cacheKey, {
            promise,
            response: undefined,
          });
        }

        return promise;
      };
    };

    actionFunc.cache = actionCache;
    actionFunc.apiName = actionName;

    memo[actionName] = actionFunc as unknown as APIAction;

    return memo;
  }, result as ConfigureAPIActionMap);

  return result as ConfigureAPIActionMap;
}

export default function configureApi(
  apiConfig: APIConfig[],
): ReturnType<typeof configureApiEntries>['actions'] {
  const { actions } = configureApiEntries(apiConfig);

  return actions;
}

function configureApiEntries(apiConfig: APIConfig[]) {
  return apiConfig.reduce<{
    actions: APIActionMap;
    entryCache: APICache;
  }>(
    (memo, [configEntries, commonConfig]) => {
      const apiCaller = createApiCaller({
        adapter: Array.isArray(commonConfig.adapter)
          ? commonConfig.adapter[0]
          : commonConfig.adapter,
      }) as APICaller;

      Object.keys(configEntries).forEach((entryKey) => {
        const entryConfig = configEntries[entryKey];
        const entryActions = configureActions(entryKey, entryConfig, commonConfig, {
          apiCaller,
          entryCache: memo.entryCache,
        });

        memo.entryCache[entryKey] = entryActions.actionCacheList;

        Object.keys(entryActions).forEach((key) => {
          assert(memo.actions[key] == null, `Duplicate action ${key}`);
          memo.actions[key] = entryActions[key];
        });
      });

      return memo;
    },
    { actions: {}, entryCache: {} },
  );
}
