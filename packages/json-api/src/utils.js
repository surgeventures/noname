export const jsonApiMediaType = "(application/vnd.api+json";

export const identity = x => x;

const transformKeysDeep = (obj, keyFn) => {
  if (Array.isArray(obj)) {
    return obj.map(o => transformKeysDeep(o, keyFn));
  }
  if (obj instanceof Object) {
    return Object.entries(obj).reduce((accum, [key, value]) => {
      const newKey = keyFn(key);
      // eslint-disable-next-line no-param-reassign
      accum[newKey] = transformKeysDeep(value, keyFn);
      return accum;
    }, {});
  }
  return obj;
};

export const kebabCase = str => {
  return str
    .split(/([A-Z][a-z0-9]+)/g)
    .map(s => s.toLowerCase())
    .filter(s => !!s.length)
    .join("-");
};

export const kebabCaseDeep = obj => transformKeysDeep(obj, kebabCase);

export const camelCase = str => {
  return str
    .split("-")
    .map((s, index) =>
      index > 0 ? s.slice(0, 1).toUpperCase() + s.slice(1) : s
    )
    .join("");
};

export const camelCaseDeep = obj => transformKeysDeep(obj, camelCase);
