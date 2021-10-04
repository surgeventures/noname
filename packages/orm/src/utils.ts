import ops from "immutable-ops";
import { FILTER, EXCLUDE } from "./constants";
import { AnyModel } from "./Model";
import { AnyObject, ModelId, QueryClause } from "./types";

/**
 * @module utils
 */

function capitalize(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

/**
 * Returns the branch name for a many-to-many relation.
 * The name is the combination of the model name and the field name the relation
 * was declared. The field name's first letter is capitalized.
 *
 * Example: model `Author` has a many-to-many relation to the model `Book`, defined
 * in the `Author` field `books`. The many-to-many branch name will be `AuthorBooks`.
 *
 * @param  {string} declarationModelName - the name of the model the many-to-many relation was declared on
 * @param  {string} fieldName            - the field name where the many-to-many relation was declared on
 * @return {string} The branch name for the many-to-many relation.
 */
function m2mName(declarationModelName: string, fieldName: string) {
  return declarationModelName + capitalize(fieldName);
}

/**
 * Returns the fieldname that saves a foreign key to the
 * model id where the many-to-many relation was declared.
 *
 * Example: `Author` => `fromAuthorId`
 *
 * @private
 * @param  {string} declarationModelName - the name of the model where the relation was declared
 * @return {string} the field name in the through model for `declarationModelName`'s foreign key.
 */
function m2mFromFieldName(declarationModelName: string) {
  return `from${declarationModelName}Id`;
}

/**
 * Returns the fieldname that saves a foreign key in a many-to-many through model to the
 * model where the many-to-many relation was declared.
 *
 * Example: `Book` => `toBookId`
 *
 * @param  {string} otherModelName - the name of the model that was the target of the many-to-many
 *                                   declaration.
 * @return {string} the field name in the through model for `otherModelName`'s foreign key..
 */
function m2mToFieldName(otherModelName: string) {
  return `to${otherModelName}Id`;
}

function reverseFieldName(modelName: string) {
  return modelName.toLowerCase() + "Set"; // eslint-disable-line prefer-template
}

/**
 * Normalizes `entity` to an id, where `entity` can be an id
 * or a Model instance.
 *
 * @param  {*} entity - either a Model instance or an id value
 * @return {*} the id value of `entity`
 */
function normalizeEntity(
  entity: undefined | null | AnyModel | ModelId | object
) {
  if (
    entity !== null &&
    typeof entity !== "undefined" &&
    typeof (entity as AnyModel).getId === "function"
  ) {
    return (entity as AnyModel).getId();
  }
  return entity as ModelId;
}

function reverseFieldErrorMessage(
  modelName: string,
  fieldName: string,
  toModelName: string,
  backwardsFieldName: string
) {
  return [
    `Reverse field ${backwardsFieldName} already defined`,
    ` on model ${toModelName}. To fix, set a custom related`,
    ` name on ${modelName}.${fieldName}.`,
  ].join("");
}

function objectShallowEquals(a: AnyObject, b: AnyObject) {
  let keysInA = 0;

  // eslint-disable-next-line consistent-return
  Object.entries(Object(a)).forEach(([key, value]) => {
    if (!b.hasOwnProperty(key) || b[key] !== value) {
      return false;
    }
    keysInA++;
  });

  return keysInA === Object.keys(b).length;
}

export type ArrayDiffActionsResult = {
  add: ModelId[],
  delete: ModelId[],
};

function arrayDiffActions(sourceArr: ModelId[], targetArr: ModelId[]): ArrayDiffActionsResult | null {
  const itemsInBoth = sourceArr.filter((item) => targetArr.includes(item));
  const deleteItems = sourceArr.filter((item) => !itemsInBoth.includes(item));
  const addItems = targetArr.filter((item) => !itemsInBoth.includes(item));

  if (deleteItems.length || addItems.length) {
    return {
      delete: deleteItems,
      add: addItems,
    };
  }
  return null;
}

const { getBatchToken } = ops;

function clauseFiltersByAttribute(
  {
    type,
    payload,
  }: QueryClause<{
    [attr: string]: any;
  }>,
  attribute: string = ""
) {
  if (type !== FILTER) return false;

  if (typeof payload !== "object") {
    /**
     * payload could also be a function in which case
     * we would have no way of knowing what it does,
     * so we default to false for non-objects
     */
    return false;
  }

  if (!payload.hasOwnProperty(attribute)) return false;
  const attributeValue = payload[attribute];
  if (attributeValue === null) return false;
  if (attributeValue === undefined) return false;

  return true;
}

function clauseReducesResultSetSize({ type }: QueryClause) {
  return [FILTER, EXCLUDE].includes(type);
}

export {
  m2mName,
  m2mFromFieldName,
  m2mToFieldName,
  reverseFieldName,
  normalizeEntity,
  reverseFieldErrorMessage,
  objectShallowEquals,
  ops,
  arrayDiffActions,
  getBatchToken,
  clauseFiltersByAttribute,
  clauseReducesResultSetSize,
};
