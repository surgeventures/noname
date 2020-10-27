import { JSONValue, JSONAPIDocument, JSONAPIResource } from "@fresha/noname-core";
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
import DuplicateResourceError from "./DuplicateResourceError";

export enum KeyTransforms {
  Kebab = "kebab",
  Default = "default"
}

type RegistryCreateOptions = {
  keyTransform: KeyTransforms;
};

const keyTransformMapping = {
  [KeyTransforms.Kebab]: kebabCaseDeep,
  [KeyTransforms.Default]: identity
};

const keyParseMapping = {
  [KeyTransforms.Kebab]: camelCaseDeep,
  [KeyTransforms.Default]: identity
};

export default class RegistryImpl implements Registry {
  private readonly options?: RegistryCreateOptions;

  private readonly resources: MapObject<Resource>;

  public readonly keyTransformFunc: TransformFunc;

  public readonly keyParseFunc: TransformFunc;

  constructor(
    options: RegistryCreateOptions = { keyTransform: KeyTransforms.Default }
  ) {
    this.options = options;
    this.resources = {};

    this.keyTransformFunc = keyTransformMapping[this.options.keyTransform];
    this.keyParseFunc = keyParseMapping[this.options.keyTransform];
  }

  define(type: string, spec: ResourceSpec): Resource {
    const resource = new ResourceImpl(this, type, spec);
    if (type in this.resources) {
      throw new DuplicateResourceError(type);
    }
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
          return {
            ...accum,
            [`${res.type}:${resource.id as string}`]: resource
          };
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
