import assert from 'assert';

import type {
  APIOperationConfigOptions,
  APICreateOperationTemplateParams,
  APIDeleteOperationTemplateParams,
  APIListOperationTemplateParams,
  APIOperationTemplateOptions,
  APIPatchOperationTemplateParams,
  APIReadOperationTemplateParams,
  APISingleDeleteOperationTemplateParams,
  APISinglePatchOperationTemplateParams,
  APISingleReadOperationTemplateParams,
  APISingleUpdateOperationTemplateParams,
  APIUpdateOperationTemplateParams,
  paramsType,
} from './types';
import { formatQueryString, formatRequestBody } from './utils';

export const CACHE_OPTIONS = {
  expirationTime: 300, // in seconds
  size: 10,
  makeKey: (_actionName: string, url: string) => url,
};

const OPERATIONS = {
  list: {
    // action signature: () => Promise(response)
    actionName: name => `read_${name}_list`,
    startActionPayload: null,
    endActionPayload: null,
    httpMethod: 'get',
    makeUrl: (actionParams, operationConfig, config, options) => {
      const queryString = formatQueryString(actionParams, operationConfig);
      const format = options.adapter.indexOf('jsonapi') < 0 ? '.json' : '';
      return `${options.rootUrl}/${config.url}${format}${queryString}`;
    },
    makeApiParams: (/* params, config, options */) => ({ httpMethod: 'get' }),
    cache: CACHE_OPTIONS,
    expireCache: false,
  } as APIListOperationTemplateParams,
  create: {
    // action signature: (attr) => Promise(response)
    actionName: name => `create_${name}`,
    startActionPayload: null,
    endActionPayload: null,
    httpMethod: 'post',
    makeUrl: (_actionParams, _operationConfig, config, options) => {
      const format = options.adapter.indexOf('jsonapi') < 0 ? '.json' : '';
      return `${options.rootUrl}/${config.url}${format}`;
    },
    makeApiParams: (params, config /* , options */) => ({
      httpMethod: 'post',
      body: formatRequestBody(params[0], config),
    }),
    cache: null,
    expireCache: true,
  } as APICreateOperationTemplateParams,
  read: {
    // action signature: (id [, query]) => Promise(response)
    actionName: name => `read_${name}`,
    startActionPayload: null,
    endActionPayload: (id, attr) => ({ id, attr }),
    httpMethod: 'get',
    makeUrl: ([identifier, ...params], operation, config, options) => {
      const queryString = formatQueryString(params as paramsType, operation);
      const format = options.adapter.indexOf('jsonapi') < 0 ? '.json' : '';
      return `${options.rootUrl}/${config.url}/${String(identifier)}${format}${queryString}`;
    },
    makeApiParams: (/* params, config, options */) => ({ httpMethod: 'get' }),
    cache: CACHE_OPTIONS,
    expireCache: false,
  } as APIReadOperationTemplateParams,
  update: {
    // action signature: (id, newAttr) => Promise(response)
    actionName: name => `update_${name}`,
    startActionPayload: (id, attr) => ({ id, attr }),
    endActionPayload: (id, attr) => ({ id, attr }),
    httpMethod: 'put',
    makeUrl: (params, _operation, config, options) => {
      const format = options.adapter.indexOf('jsonapi') < 0 ? '.json' : '';
      return `${options.rootUrl}/${config.url}/${String(params[0])}${format}`;
    },
    makeApiParams: (params, config /* , options */) => ({
      httpMethod: 'put',
      body: formatRequestBody(params[1], config),
    }),
    cache: null,
    expireCache: true,
  } as APIUpdateOperationTemplateParams,
  patch: {
    // action signature: (id, newAttr) => Promise(response)
    actionName: name => `patch_${name}`,
    startActionPayload: (id, attr) => ({ id, attr }),
    endActionPayload: (id, attr) => ({ id, attr }),
    httpMethod: 'patch',
    makeUrl: (params, _operation, config, options) => {
      const format = options.adapter.indexOf('jsonapi') < 0 ? '.json' : '';
      return `${options.rootUrl}/${config.url}/${String(params[0])}${format}`;
    },
    makeApiParams: (params, config /* , options */) => ({
      httpMethod: 'patch',
      body: formatRequestBody(params[1], config),
    }),
    cache: null,
    expireCache: true,
  } as APIPatchOperationTemplateParams,
  delete: {
    // action signature: (id) => Promise(response)
    actionName: name => `delete_${name}`,
    startActionPayload: null,
    endActionPayload: null,
    httpMethod: 'delete',
    makeUrl: ([identifier, ...params], operation, config, options) => {
      const queryString = formatQueryString(params as paramsType, operation);
      const format = options.adapter.indexOf('jsonapi') < 0 ? '.json' : '';
      return `${options.rootUrl}/${config.url}/${String(identifier)}${format}${queryString}`;
    },
    makeApiParams: (/* params, config, options */) => ({ httpMethod: 'delete' }),
    cache: null,
    expireCache: true,
  } as APIDeleteOperationTemplateParams,
  'single-read': {
    // action signature: () => Promise(response)
    actionName: name => `read_${name}`,
    startActionPayload: () => null,
    endActionPayload: null,
    httpMethod: 'get',
    makeUrl: (params, operation, config, options) => {
      const queryString = formatQueryString(params as paramsType, operation);
      const format = options.adapter.indexOf('jsonapi') < 0 ? '.json' : '';
      return `${options.rootUrl}/${config.url}${format}${queryString}`;
    },
    makeApiParams: (/* params, config, options */) => ({ httpMethod: 'get' }),
    cache: CACHE_OPTIONS,
    expireCache: false,
  } as APISingleReadOperationTemplateParams,
  'single-update': {
    // action signature: (newAttr) => Promise(response)
    actionName: name => `update_${name}`,
    startActionPayload: null,
    httpMethod: 'put',
    makeUrl: (_params, _operation, config, options) => {
      const format = options.adapter.indexOf('jsonapi') < 0 ? '.json' : '';
      return `${options.rootUrl}/${config.url}${format}`;
    },
    makeApiParams: (params, config /* , options */) => ({
      httpMethod: 'put',
      body: formatRequestBody(params[0], config),
    }),
    cache: null,
    expireCache: true,
  } as APISingleUpdateOperationTemplateParams,
  'single-patch': {
    // action signature: (newAttr) => Promise(response)
    actionName: name => `patch_${name}`,
    startActionPayload: null,
    httpMethod: 'patch',
    makeUrl: (_params, _operation, config, options) => {
      const format = options.adapter.indexOf('jsonapi') < 0 ? '.json' : '';
      return `${options.rootUrl}/${config.url}${format}`;
    },
    makeApiParams: (params, config /* , options */) => ({
      httpMethod: 'patch',
      body: formatRequestBody(params[0], config),
    }),
    cache: null,
    expireCache: true,
  } as APISinglePatchOperationTemplateParams,
  'single-delete': {
    // action signature: () => Promise(response)
    actionName: name => `delete_${name}`,
    startActionPayload: null,
    httpMethod: 'delete',
    makeUrl: (_params, _operation, config, options) => {
      const format = options.adapter.indexOf('jsonapi') < 0 ? '.json' : '';
      return `${options.rootUrl}/${config.url}${format}`;
    },
    makeApiParams: (/* params, config, options */) => ({ httpMethod: 'delete' }),
    cache: null,
    expireCache: true,
  } as APISingleDeleteOperationTemplateParams,
};

/*
Supports operation definitions:

'list' - options are taken from OPERATIONS

['list', { ... }] - options are taken from OPERATIONS, but then are
  overwritten with { ... }

{ ... } - options are used 'as is'
*/
export default function parseOperation(op: APIOperationConfigOptions) {
  let result: APIOperationConfigOptions | APIOperationTemplateOptions = op;
  if (Array.isArray(op)) {
    const [operName, operOptions] = op;
    const baseOptions = { ...OPERATIONS[operName] };
    if (baseOptions) {
      const { cache, ...restOptions } = operOptions;
      if (baseOptions.cache) {
        if (cache === true) {
          // use default cache settings
        } else if (cache === false || cache === undefined || cache === null) {
          baseOptions.cache = null;
        } else if (typeof cache === 'number') {
          baseOptions.cache = { ...baseOptions.cache, expirationTime: cache };
        } else if (cache instanceof Object) {
          baseOptions.cache = { ...cache };
        }
      }
      result = { ...baseOptions, ...restOptions } as APIOperationTemplateOptions;
    }
  } else if (typeof op === 'string') {
    result = { ...OPERATIONS[op], cache: null } as APIOperationTemplateOptions;
  }
  assert(result, `Unsupported operation ${String(op)}`);
  return result;
}
