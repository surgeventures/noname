import {
  JSONAPIResource,
  JSONAPIDocument,
  JSONObject,
  JSONValue,
  JSONAPIResourceRelationship,
  JSONAPIResourceId
} from "./jsonApiTypes";
import {
  IncludesMap,
  MapObject,
  Registry,
  Resource,
  ResourceAttributesSpec,
  ResourceParseOptions,
  ResourceRelationshipsSpec,
  ResourceSpec
} from "./types";

type ResourceIdMapper = {
  attr: string;
  format(value: JSONValue): string | null | undefined;
  parse(resource: JSONAPIResourceId): string | null;
};

type ResourceAttributeMapper = {
  getter(data: JSONObject, key: string): any;
  formatter(data: JSONValue): JSONValue;
};

type ResourceAttributeHelpers = Array<[string, ResourceAttributeMapper]>;

const defaultIdMapper: ResourceIdMapper = {
  attr: "id",
  format(value) {
    if (value == null) {
      return value;
    }
    return String(value);
  },
  parse(resourceObj) {
    if (resourceObj.id != null) {
      return String(resourceObj.id);
    }
    return null;
  }
};

const defaultAttributeMapper: ResourceAttributeMapper = {
  getter: (data: JSONObject, key: string) => data[key] as JSONObject,
  formatter: (value: JSONValue) => value
};

type ResourceRelationshipMapper = (
  data: JSONObject,
  key: string
) => JSONAPIResourceRelationship;

type ResourceRelationshipHelpers = Array<[string, ResourceRelationshipMapper]>;

function normalizeAttributes(
  specs?: ResourceAttributesSpec
): ResourceAttributeHelpers {
  if (Array.isArray(specs)) {
    return specs.map(spec => {
      if (typeof spec === "string") {
        return [spec, defaultAttributeMapper];
      }
      return spec;
    });
  }
  if (specs != null) {
    return Object.entries(specs).map(([key, value]) => [
      key,
      { ...defaultAttributeMapper, ...value }
    ]);
  }
  return [];
}

// a runtime equivalent of `value implements Resource`
function isResource(value: any): value is Resource {
  return "document" in value && "resource" in value && "parse" in value;
}

function normalizeRelationships(
  registry: Registry,
  relationshipSpecs?: ResourceRelationshipsSpec
): ResourceRelationshipHelpers | null {
  if (relationshipSpecs != null) {
    return Object.entries(relationshipSpecs).map(([key, value]) => {
      const getter = (data: JSONObject, dataKey: string) => {
        let relatedResourceClass: Resource | null;
        if (typeof value === "string") {
          relatedResourceClass = registry.find(value);
        } else if (isResource(value)) {
          relatedResourceClass = value;
        } else {
          relatedResourceClass = registry.find(
            (value as { type: string }).type
          );
        }

        if (relatedResourceClass == null) {
          throw new Error(`Cannot find ${dataKey} resource`);
        }

        // eslint-disable-next-line no-underscore-dangle
        const formatRelationship = (value as { _embed?: boolean })._embed
          ? (r: JSONObject) => (relatedResourceClass as Resource).resource(r)
          : (r: JSONObject) => (relatedResourceClass as Resource).link(r);

        const raw = data[dataKey];
        if (Array.isArray(raw)) {
          return {
            data: raw.map(formatRelationship)
          };
        }
        if (raw != null) {
          return {
            data: formatRelationship(raw as JSONObject)
          };
        }
        return {
          data: null
        };
      };

      return [key, getter as ResourceRelationshipMapper];
    });
  }
  return null;
}

export default class ResourceImpl implements Resource {
  private readonly registry: Registry;

  private readonly type: string;

  private readonly idSpec: ResourceIdMapper;

  private readonly attributes: ResourceAttributeHelpers;

  private readonly relationships: ResourceRelationshipHelpers | null;

  constructor(registry: Registry, type: string, spec: ResourceSpec) {
    this.registry = registry;
    this.type = type;
    this.idSpec = { ...defaultIdMapper, ...spec.id };
    this.attributes = normalizeAttributes(spec.attributes);
    this.relationships = normalizeRelationships(registry, spec.relationships);
  }

  id(value: JSONValue): { type: string; id: string | null | undefined } {
    return {
      type: this.type,
      id: this.idSpec.format(value)
    };
  }

  link(value: JSONObject): JSONAPIResourceId {
    return {
      type: this.type,
      id: this.idSpec.format(value) as string
    };
  }

  resource(data: JSONObject): JSONAPIResource {
    const result: MapObject<any> = {
      type: this.type
    };

    const id = this.idSpec.format(data[this.idSpec.attr]);
    if (id !== undefined) {
      result.id = id;
    }

    result.attributes = this.registry.keyTransformFunc(
      this.attributes.reduce((accum: MapObject<any>, [key, desc]) => {
        const value = desc.formatter(desc.getter(data, key));
        return value !== undefined ? { ...accum, [key]: value } : accum;
      }, {})
    );

    if (this.relationships != null) {
      result.relationships = this.registry.keyTransformFunc(
        this.relationships.reduce((accum: MapObject<any>, [key, desc]) => {
          const value = desc(data, key);
          if (value !== undefined) {
            const resultKey = this.registry.keyTransformFunc(key) as string;
            return { ...accum, [resultKey]: value };
          }
          return accum;
        }, {})
      );
    }

    return result as JSONAPIResource;
  }

  document(data: JSONObject): JSONAPIDocument {
    return {
      data: {
        ...this.resource(data)
      }
    };
  }

  parse(
    data: JSONAPIResource,
    includesMap?: IncludesMap,
    options?: ResourceParseOptions
  ): JSONObject {
    const result: MapObject<any> = {};

    if (options && options.typeAttr) {
      result[options.typeAttr] = this.type;
    }

    result[this.idSpec.attr] = this.idSpec.parse(data);

    const attributes = this.registry.keyParseFunc(data.attributes || {});
    Object.entries(attributes as JSONObject).forEach(([name, value]) => {
      result[name] = value;
    });

    const getRelatedObject = (link: JSONAPIResourceId) => {
      if (link) {
        if (includesMap) {
          const obj = includesMap[`${link.type}:${link.id}`];
          if (obj) {
            return obj;
          }
        }
        return this.idSpec.parse(link);
      }
      return null;
    };

    const relationships = this.registry.keyParseFunc(
      (data.relationships as JSONObject) || {}
    );
    Object.entries(
      relationships as Record<string, JSONAPIResourceRelationship>
    ).forEach(([name, value]) => {
      if (Array.isArray(value.data)) {
        // TODO in debug version check for heterogeneous collections
        result[name] = value.data.map(getRelatedObject);
      } else if (value.data) {
        result[name] =
          value.data.id != null ? getRelatedObject(value.data) : null;
      } else if (value.data == null) {
        result[name] = null;
      }
    });

    return result;
  }
}
