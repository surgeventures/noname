/* eslint-disable no-use-before-define */

export type JSONPrimitive = null | boolean | number | string;

export type JSONValue = JSONPrimitive | JSONArray | JSONObject;

export type JSONArray = ArrayLike<JSONValue>;

export type JSONObject = {
  [key: string]: JSONValue;
};
