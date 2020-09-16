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
    if (value === null) {
      return null;
    }
    if (value === undefined) {
      return undefined;
    }
    return String(value);
  },
  parse(resourceObj) {
    return resourceObj.id != null ? String(resourceObj.id) : null;
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

export default class ResourceImpl implements Resource {
  private registry: Registry;

  private type: string;

  private idSpec: ResourceIdMapper;

  private attributes: ResourceAttributeHelpers;

  private relationships: ResourceRelationshipHelpers | null;

  constructor(registry: Registry, type: string, spec: ResourceSpec) {
    this.registry = registry;
    this.type = type;
    this.idSpec = { ...defaultIdMapper, ...spec.id };
    this.attributes = this.normalizeAttributes(spec.attributes);
    this.relationships = this.normalizeRelationships(
      registry,
      spec.relationships
    );
  }

  // eslint-disable-next-line class-methods-use-this
  private normalizeAttributes(
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

  // eslint-disable-next-line class-methods-use-this
  private normalizeRelationships(
    registry: Registry,
    relationshipSpecs?: ResourceRelationshipsSpec
  ): ResourceRelationshipHelpers | null {
    if (relationshipSpecs != null) {
      return Object.entries(relationshipSpecs).map(([key, value]) => {
        // eslint-disable-next-line no-shadow
        const getter = (data: JSONObject, key: string) => {
          let relatedResourceClass: Resource | null;
          if (typeof value === "string") {
            relatedResourceClass = registry.find(value);
          } else if (value instanceof ResourceImpl) {
            relatedResourceClass = value;
          } else {
            relatedResourceClass = registry.find(
              (value as { type: string }).type
            );
          }

          if (relatedResourceClass == null) {
            throw new Error(`Cannot find ${key} resource`);
          }

          // eslint-disable-next-line no-underscore-dangle
          const formatRelationship = (value as { _embed?: boolean })._embed
            ? (r: JSONObject) => (relatedResourceClass as Resource).resource(r)
            : (r: JSONObject) => (relatedResourceClass as Resource).link(r);

          const raw = data[key];
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
        if (value !== undefined) {
          // eslint-disable-next-line no-param-reassign
          accum[key] = value;
        }
        return accum;
      }, {})
    );

    if (this.relationships != null) {
      result.relationships = this.registry.keyTransformFunc(
        this.relationships.reduce((accum: MapObject<any>, [key, desc]) => {
          const value = desc(data, key);
          if (value !== undefined) {
            const resultKey = this.registry.keyTransformFunc(key) as string;
            // eslint-disable-next-line no-param-reassign
            accum[resultKey] = value;
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
