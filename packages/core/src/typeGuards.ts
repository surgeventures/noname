import { JSONValue, JSONObject } from './jsonTypes';

export const isJSONObject = (value: JSONValue): value is JSONObject =>
  !Array.isArray(value) && value !== null && typeof value === 'object';

export const isJSONValueArray = (value: JSONValue | JSONValue[] | null): value is JSONValue[] =>
  value !== null && Array.isArray(value);
