import assert from 'assert';

import { APICaller, APICallerParams, APICallerResponse, APICommonConfig } from './types';

const METHODS_WITH_BODY = /^(post|put|patch)$/i;
const METHODS_WITH_CONTENT_TYPE = /^(post|put|patch|delete)$/i;

export function superagentCall(
  url: string,
  {
    httpMethod,
    body = null,
    headers = {},
    withCredentials = true,
    binary = false,
  }: APICallerParams,
): Promise<APICallerResponse> {
  const bodyAllowed = METHODS_WITH_BODY.test(httpMethod);
  assert(httpMethod, 'Missing httpMethod parameter');
  assert(bodyAllowed || body == null, `Body is not allowed for ${httpMethod}`);

  return fetch(url, {
    method: httpMethod,
    credentials: withCredentials ? 'include' : undefined,
    headers,
    body: bodyAllowed && body != null ? String(body) : undefined,
  }).then((response) => {
    if (!response.ok) {
      return Promise.reject();
    }
    if (binary) {
      return response.blob();
    }
    return response.json();
  });
}

const rawApiCall: APICaller = (url, params) => {
  const { headers: paramHeaders = {}, ...otherParams } = params;
  const headers = {
    'Content-Type': 'application/json',
    ...paramHeaders,
    'X-Requested-With': 'XMLHttpRequest',
  };
  return superagentCall(url, { ...otherParams, headers });
};

const jsonApiCall: APICaller = (url, params) => {
  const { headers: paramHeaders = {} } = params;

  const headers = {
    Accept: 'application/vnd.api+json',
    ...(METHODS_WITH_CONTENT_TYPE.test(params.httpMethod)
      ? {
          'Content-Type': 'application/vnd.api+json',
        }
      : {}),
    ...paramHeaders,
  };
  return superagentCall(url, { ...params, headers });
};

export const createApiCaller = ({
  adapter,
}: {
  adapter: APICommonConfig['adapter'];
}): APICaller | APICommonConfig['adapter'] => {
  switch (adapter) {
    case 'raw':
      return rawApiCall;
    case 'jsonapi':
      return jsonApiCall;
    default:
      return adapter;
  }
};
