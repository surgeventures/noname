import type { paramsType, APIOperationParams, APIEntryConfig, APIOperationConfigOverrides } from "./types";
import { kebabCase, JSONObject, kebabCaseDeep } from "@fresha/noname-core";

export function formatQueryString(
  params: paramsType,
  operationConfig: APIOperationParams,
  options = { transformKeys: kebabCase },
) {
  const allowedParams = operationConfig?.queryParams || [];
  let paramValues: JSONObject = {};
  if (Array.isArray(params)) {
    paramValues = params[0] as JSONObject;
  } else if (params) {
    paramValues = params as JSONObject;
  }
  const urlSearchParams = new URLSearchParams();
  Object.entries(paramValues).forEach(([paramName, paramValue]) => {
    if (allowedParams.includes(paramName)) {
      const qsParamName = options.transformKeys(paramName);
      switch (typeof paramValue) {
        case 'boolean':
          urlSearchParams.set(qsParamName, String(paramValue ? 1 : 0));
          break;
        case 'string':
          urlSearchParams.set(qsParamName, paramValue);
          break;
        case 'number':
          urlSearchParams.set(qsParamName, String(paramValue));
          break;
        case 'object':
          urlSearchParams.set(qsParamName, JSON.stringify(paramValue));
          break;
        default:
          break;
      }
    }
  });
  return urlSearchParams.toString();
}

export function formatRequestBody(params: paramsType, operationConfig: APIEntryConfig) {
  if (!operationConfig?.operations) {
    return {};
  }
  const operationConfigOperation =
    (operationConfig?.operations[1] as APIOperationConfigOverrides) || {};
  const paramsToSkip = operationConfigOperation?.queryParams || [];
  return Object.keys(params || {}).reduce<JSONObject>((memo, name) => {
    if (!paramsToSkip.includes(name)) {
      const key = kebabCase(name);
      memo[key] = kebabCaseDeep((params as Record<string, JSONObject>)[name] as JSONObject);
    }
    return memo;
  }, {});
}
