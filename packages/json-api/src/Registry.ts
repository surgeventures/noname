import { JSONValue, JSONAPIDocument, JSONAPIResource } from "./jsonApiTypes";
import {
  IncludesMap,
  MapObject,
  Registry,
  Resource,
  ResourceParseOptions,
  ResourceSpec
} from "./types";
import { identity, kebabCaseDeep, camelCaseDeep, TransformFunc } from "./utils";
import ResourceImpl from "./Resource";

export type RegistryCreateOptions = {
  keyTransform?: "kebab";
};

export default class RegistryImpl implements Registry {
  private options?: RegistryCreateOptions;

  private resources: MapObject<Resource>;

  public keyTransformFunc: TransformFunc;

  public keyParseFunc: TransformFunc;

  constructor(options?: RegistryCreateOptions) {
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

  define(type: string, spec: ResourceSpec): Resource {
    const resource = new ResourceImpl(this, type, spec);
    this.resources[type] = resource;
    return resource;
  }

  find(type: string): Resource | null {
    return this.resources[type];
  }

  format(type: string, data: JSONValue): JSONAPIDocument {
    const resource = this.find(type);
    if (!resource) {
      throw new Error(`Cannot find resource ${type}`);
    }
    return resource.document(data);
  }

  parse(document: JSONAPIDocument, options?: ResourceParseOptions): JSONValue {
    const parseResource = (
      data: JSONAPIResource,
      includesMap?: IncludesMap
    ) => {
      const resource = this.find(data.type);

      if (!resource) {
        throw new Error(`Cannot find resource ${data.type}`);
      }

      return resource.parse(data, includesMap, options);
    };

    const includesMap: IncludesMap | undefined = Array.isArray(
      document.included
    )
      ? document.included.reduce((accum: IncludesMap, res) => {
          const resource = parseResource(res);
          // eslint-disable-next-line no-param-reassign
          accum[`${res.type}:${resource.id as string}`] = resource;
          return accum;
        }, {})
      : undefined;

    if (Array.isArray(document.data)) {
      return (document.data as JSONAPIResource[]).map(elem =>
        parseResource(elem, includesMap)
      );
    }
    return parseResource(document.data as JSONAPIResource, includesMap);
  }
}

export const registry = new RegistryImpl();
