/* eslint-disable no-use-before-define */

import {
  JSONAPIDocument,
  JSONAPIResource,
  JSONAPIResourceId,
  JSONObject,
  JSONValue,
  TransformFunc
} from "@fresha/noname-core";

export type MapObject<V> = {
  [key: string]: V;
};

export interface Registry {
  readonly keyTransformFunc: TransformFunc;
  readonly keyParseFunc: TransformFunc;
  define(type: string, spec: ResourceSpec): Resource;
  find(type: string): Resource | null;
  format(type: string, data: JSONValue): JSONAPIDocument;
  parse(document: JSONAPIDocument, options?: ResourceParseOptions): JSONValue;
}

export type ResourceSpec = {
  id?: ResourceIdSpec;
  attributes?: ResourceAttributesSpec;
  relationships?: ResourceRelationshipsSpec;
};

export type ResourceIdSpec = {
  attr?: string;
  format?(value: JSONValue): string | null | undefined;
  parse?(resource: JSONAPIResourceId): string | null;
};

export type ResourceAttributeSpec = {
  getter?(data: JSONObject, key: string): any;
  formatter?(data: JSONObject): any;
};

export type ResourceAttributesSpec =
  | string[]
  | {
      [attrName: string]: ResourceAttributeSpec;
    };

export type ResourceRelationshipSpec =
  | string
  | Resource
  | {
      type: string;
      _embed?: boolean;
    };

export type ResourceRelationshipsSpec = {
  [relationshipName: string]: ResourceRelationshipSpec;
};

export type IncludesMap = {
  [resourceType: string]: JSONValue;
};

export type ResourceParseOptions = {
  typeAttr?: string;
  includedInResponse?: boolean;
};

export interface Resource {
  id(value: JSONValue): { type: string; id: string | null | undefined };
  link(value: JSONObject): JSONAPIResourceId;
  resource(data: JSONObject): JSONAPIResource;
  document(data: JSONValue): JSONAPIDocument;
  parse(
    data: JSONAPIResource,
    includesMap?: IncludesMap,
    options?: ResourceParseOptions
  ): JSONObject;
}
