/* eslint-disable no-use-before-define */

/* JSON API definitions */

export const JSON_API_MEDIA_TYPE = 'application/vnd.api+json';

export type JSONAPIError = {
  id?: string;
  links?: JSONAPILinks;
  status?: string;
  code?: string;
  title?: string;
  detail?: string;
  source?: {
    pointer?: string;
    parameter?: string;
    [propName: string]: any;
  };
  meta?: JSONAPIMeta;
};

type JSONAPIImplementationInfo = {
  version?: string;
  meta?: JSONAPIMeta;
};

type JSONAPITopLevelLinks = {
  self?: JSONAPILink;
  related?: JSONAPILink;
  first?: JSONAPILink | null;
  last?: JSONAPILink | null;
  prev?: JSONAPILink | null;
  next?: JSONAPILink | null;
};

export type JSONAPIDocument = {
  data: JSONAPIResource | JSONAPIResource[] | JSONAPIResourceId | JSONAPIResourceId[] | null;
  errors?: JSONAPIError[];
  meta?: JSONAPIMeta;
  jsonapi?: JSONAPIImplementationInfo;
  links?: JSONAPITopLevelLinks;
  included?: JSONAPIResource[];
};

export type JSONAPIResourceAttributes = {
  [attr: string]: any;
};

export type JSONAPIResourceRelationship = {
  links?: JSONAPILinks;
  data: JSONAPIResourceId | JSONAPIResourceId[] | null;
  meta?: JSONAPIMeta;
};

export type JSONAPIResource = {
  type: string;
  id: string;
  attributes?: JSONAPIResourceAttributes;
  relationships?: {
    [relationName: string]: JSONAPIResourceRelationship;
  };
};

export type JSONAPILinks = {
  [link: string]: JSONAPILink;
};

export type JSONAPIMeta = {
  links?: JSONAPILinks;
  [prop: string]: any;
};

export type JSONAPILink =
  | string
  | {
      href: string;
      meta?: JSONAPIMeta;
    };

export type JSONAPIResourceId = {
  type: string;
  id: string;
  meta?: JSONAPIMeta;
};
