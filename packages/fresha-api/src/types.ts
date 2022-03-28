import { JSONAPIDocument, JSONObject, JSONPrimitive, JSONValue } from '@fresha/noname-core';
import type { Action } from 'redux-actions';

export type Session = Record<string, never>;

export type HTTPMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type APICallerParams = {
  httpMethod: HTTPMethod;
  body?: JSONValue;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  binary?: boolean;
};

export type APICallerResponse = {
  body: JSONValue;
};

export type APICaller = (url: string, params: APICallerParams) => Promise<APICallerResponse>;

/**
 * Predefined action templates.
 */
export type APIOperationTemplateName =
  | 'list'
  | 'create'
  | 'read'
  | 'update'
  | 'patch'
  | 'delete'
  | 'single-read'
  | 'single-update'
  | 'single-patch'
  | 'single-delete';

export type APIOperationTemplateParams = {
  makeUrl: APIMakeUrlFunc;
  makeApiParams: APIMakeParamsFunc;
  cache: APIOperationCacheParams | null;
  expireCache: boolean;
  queryParams: string[];
  ignoreOffline: boolean;
  noRedirectOnUnauthorized: boolean;
  clearOrmModels: boolean;
};

export interface APIListOperationTemplateParams extends APIOperationTemplateParams {
  actionName: (entryKey: string) => `read_${typeof entryKey}_list`;
  startActionPayload: null;
  endActionPayload: null;
  httpMethod: 'get';
  makeApiParams: () => APIMakeParamsResult;
}

export interface APICreateOperationTemplateParams extends APIOperationTemplateParams {
  actionName: (entryKey: string) => `create_${typeof entryKey}`;
  startActionPayload: null;
  endActionPayload: null;
  httpMethod: 'post';
}

export interface APIReadOperationTemplateParams extends APIOperationTemplateParams {
  actionName: (entryKey: string) => `read_${typeof entryKey}`;
  startActionPayload: null;
  endActionPayload: (id: string, attr: JSONValue[]) => { id: string, attr: JSONValue[] };
  httpMethod: 'get';
  makeApiParams: () => APIMakeParamsResult;
}

export interface APIUpdateOperationTemplateParams extends APIOperationTemplateParams {
  actionName: (entryKey: string) => `update_${typeof entryKey}`;
  startActionPayload: (id: string, attr: JSONValue[]) => { id: string; attr: JSONValue[] };
  endActionPayload: (id: string, attr: JSONValue[]) => { id: string; attr: JSONValue[] };
  httpMethod: 'put';
}

export interface APIPatchOperationTemplateParams extends APIOperationTemplateParams {
  actionName: (entryKey: string) => `patch_${typeof entryKey}`;
  startActionPayload: (id: string, attr: JSONValue[]) => { id: string; attr: JSONValue[] };
  endActionPayload: (id: string, attr: JSONValue[]) => { id: string; attr: JSONValue[] };
  httpMethod: 'patch';
}

export interface APIDeleteOperationTemplateParams extends APIOperationTemplateParams {
  actionName: (entryKey: string) => `delete_${typeof entryKey}`;
  startActionPayload: null;
  endActionPayload: null;
  httpMethod: 'delete';
  makeApiParams: () => APIMakeParamsResult;
}

export interface APISingleReadOperationTemplateParams extends APIOperationTemplateParams {
  actionName: (entryKey: string) => `read_${typeof entryKey}`;
  startActionPayload: () => null;
  endActionPayload: null;
  httpMethod: 'get';
  makeApiParams: () => APIMakeParamsResult;
}

export interface APISingleUpdateOperationTemplateParams extends APIOperationTemplateParams {
  actionName: (entryKey: string) => `update_${typeof entryKey}`;
  startActionPayload: null;
  httpMethod: 'put';
}

export interface APISinglePatchOperationTemplateParams extends APIOperationTemplateParams {
  actionName: (entryKey: string) => `patch_${typeof entryKey}`;
  startActionPayload: null;
  httpMethod: 'patch';
}

export interface APISingleDeleteOperationTemplateParams extends APIOperationTemplateParams {
  actionName: (entryKey: string) => `delete_${typeof entryKey}`;
  startActionPayload: null;
  httpMethod: 'delete';
  makeApiParams: () => APIMakeParamsResult;
}

export type APIOperationTemplateOptions =
  | APIListOperationTemplateParams
  | APICreateOperationTemplateParams
  | APIReadOperationTemplateParams
  | APIUpdateOperationTemplateParams
  | APIPatchOperationTemplateParams
  | APIDeleteOperationTemplateParams
  | APISingleReadOperationTemplateParams
  | APISingleUpdateOperationTemplateParams
  | APISinglePatchOperationTemplateParams
  | APISingleDeleteOperationTemplateParams;

export type paramsType = JSONPrimitive | JSONObject | JSONValue[];

/**
 * Environment variables necessary to construct API actions out of configuration.
 * Need to be passed from outside during initialisation.
 */
export type APIEnvironmentOptions = Record<string, string>;

/**
 * This identifies 'configuration entry', i.e. group of closely related API actions.
 */
export type APIOperationParams = {
  actionName: string | ((entryKey: APIEntryKey) => string);
  queryParams: string[];
  makeUrl: APIMakeUrlFunc;
  makeApiParams: APIMakeParamsFunc;
  sessionPreconditioner?: APISessionPreconditionFunc;
  sessionPostconditioner?: APISessionPostconditionFunc;
  cache: APIOperationCacheParams | null;
  ignoreOffline: boolean;
  noRedirectOnUnauthorized: boolean;
  clearOrmModels: boolean;
};

/**
 * makeUrl function signature. This function is supposed to produce an URL for action's call.
 */
export type APIMakeUrlFunc = (
  callParams: paramsType[],
  operationConfig: APIOperationParams,
  entryConfig: APIEntryConfig,
  commonConfig: APICommonConfig,
) => string;

export type APIMakeParamsResult = Omit<APICallerParams, 'withCredentials' | 'binary'>;

/**
 * makeApiParams function signature. This function is supposed to produce parameters (except
 * URL) for action call.
 */
export type APIMakeParamsFunc = (
  callParams: paramsType[],
  entryConfig: APIEntryConfig,
) => APIMakeParamsResult;

export type APISessionPreconditionFunc = (
  session: Session,
  responseBody: JSONAPIDocument,
  args: unknown[],
) => void;
export type APISessionPostconditionFunc = (
  session: Session,
  responseBody: JSONAPIDocument,
  args: unknown[],
) => void;

export type APIOperationCacheParams = {
  expirationTime: number;
  size: number;
  // TODO add proper type to params
  makeKey: (actionName: string, url: string, params?: JSONValue) => string;
};

export type APIOperationConfigOverrides = Partial<Omit<APIOperationParams, 'cache'>> & {
  cache?: null | boolean | number | APIOperationCacheParams;
};
export type APIOperationConfig = [APIOperationTemplateName, APIOperationConfigOverrides];

export type APIOperationConfigOptions = APIOperationTemplateName | APIOperationConfig;

export type APIEntryConfig = {
  url: string;
  operations: APIOperationConfigOptions[];
  invalidatesCacheFor?: string[];
};

export type APIAdapterFunc = (
  body: JSONValue,
  options?: APIOperationTemplateOptions,
  params?: string[],
) => Action<JSONValue> & { meta?: { type: string } };

/**
 * Shape of the common part of the API configuration, which defines properties common to all actions.
 */

type APIAdapterType = 'jsonapi' | 'raw';
export type APICommonConfig = {
  rootUrl: string;
  glooRootUrl?: string;
  prefix?: string | null;
  adapter: APIAdapterType | [APIAdapterType, APIAdapterFunc];
};

/**
 * Shape of the API configuration. Final config is an array of such structures.
 */
export type APIEntryKey = string;
export type APIConfig = [Record<APIEntryKey, APIEntryConfig>, APICommonConfig];

export type APIActionCacheBody = {
  promise: Promise<JSONValue> | null;
  response: JSONValue | undefined;
  timestamp?: number;
};

export type APIActionCache = Map<string, APIActionCacheBody>;
export type APIEntryCache = APIActionCache[];
export type APICache = Record<string, APIEntryCache>;

export type ApiActionFunction = (...args: unknown[]) => APICallerResponse & { fromCache?: boolean };

export type APIAction = ApiActionFunction & {
  cache: APIEntryCache;
  apiName: string;
};

export type APIActionMap = Record<string, APIAction>;
export type ConfigureAPIActionMap = Record<string, APIAction> & { actionCacheList: APIEntryCache };
