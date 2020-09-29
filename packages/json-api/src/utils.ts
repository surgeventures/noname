import { JSONObject, JSONValue } from "./jsonApiTypes";

export const jsonApiMediaType = "application/vnd.api+json";

export type KeyTransformFunc = (x: string) => string;
export type TransformFunc = (obj: JSONValue) => JSONValue;

export const identity: TransformFunc = obj => obj;

const transformKeysDeep = (
  obj: JSONValue,
  keyFn: KeyTransformFunc
): JSONValue => {
  if (Array.isArray(obj)) {
    return obj.map(o => transformKeysDeep(o, keyFn));
  }
  if (obj instanceof Object) {
    return Object.entries(obj).reduce((accum: JSONObject, [key, value]) => {
      const newKey = keyFn(key);
      return { ...accum, [newKey]: transformKeysDeep(value, keyFn) };
    }, {});
  }
  return obj;
};

export const kebabCase: KeyTransformFunc = str => {
  return str
    .split(/([A-Z][a-z0-9]+)/g)
    .map(s => s.toLowerCase())
    .filter(s => !!s.length)
    .join("-");
};

export const kebabCaseDeep: TransformFunc = obj =>
  transformKeysDeep(obj, kebabCase);

export const camelCase: KeyTransformFunc = str => {
  return str
    .split("-")
    .map((s, index) =>
      index > 0 ? s.slice(0, 1).toUpperCase() + s.slice(1) : s
    )
    .join("");
};

export const camelCaseDeep: TransformFunc = obj =>
  transformKeysDeep(obj, camelCase);
