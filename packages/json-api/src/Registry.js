import { identity, kebabCaseDeep, camelCaseDeep } from "./utils";
import Resource from "./Resource";

export default class Registry {
  constructor(options) {
    this.options = options;
    this.resources = {};

    this.keyTransformFunc =
      this.options && this.options.keyTransform === "kebab"
        ? kebabCaseDeep
        : identity;
    this.keyParseFunc =
      this.options && this.options.keyTransform === "kebab"
        ? camelCaseDeep
        : identity;
  }

  define(type, spec) {
    const { id, attributes, relationships } = spec;
    const resource = new Resource(this, type, id, attributes, relationships);
    this.resources[type] = resource;
    return resource;
  }

  find(type) {
    return this.resources[type];
  }

  format(type, data) {
    const resource = this.find(type);
    if (!resource) {
      throw new Error(`Cannot find resource ${type}`);
    }
    return resource.document(data);
  }

  parse(document, options) {
    const parseResource = (data, includesMap) => {
      const resource = this.find(data.type);

      if (!resource) {
        throw new Error(`Cannot find resource ${data.type}`);
      }

      return resource.parse(data, includesMap, options);
    };

    const includesMap = Array.isArray(document.included)
      ? document.included.reduce((accum, res) => {
          const resource = parseResource(res);
          // eslint-disable-next-line no-param-reassign
          accum[`${res.type}:${resource.id}`] = resource;
          return accum;
        }, {})
      : null;

    if (Array.isArray(document.data)) {
      return document.data.map(elem => parseResource(elem, includesMap));
    }
    return parseResource(document.data, includesMap);
  }
}

export const registry = new Registry();
