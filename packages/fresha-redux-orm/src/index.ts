import QuerySet from "./QuerySet";
import Model, { AnyModel, ModelClassMap } from "./Model";
import ORM from "./ORM";
import Session from "./Session";
import { createReducer, createSelector } from "./redux";
import {
  ForeignKey as ForeignKeyClass,
  ManyToMany as ManyToManyClass,
  OneToOne as OneToOneClass,
  fk,
  many,
  oneToOne,
  attr,
  Attribute as AttributeClass,
  Field,
} from "./fields";
import { Attribute, ForeignKey, ManyToMany, OneToOne, registerDescriptor } from "./decorators";
import { ValidateSchema, Relations, ModelId, SessionBoundModel, TargetRelationship,
  SourceRelationship,
  ModelFieldMap,
  Ref,
  RefFromFields,
  SessionWithBoundModels,
  OrmState,
  ReduxAction,
  Descriptors,
  ModelClassType,
  OrmSelector,
  Selector,
  AnyObject,
  ModelField,
  RefWithFields,
  DescriptorsMap
} from "./types";

export { getDescriptors, ModelDescriptorsRegistry } from './modelDescriptorsRegistry';
export { attrDescriptor } from './descriptors';
export {
  QuerySet,
  Model,
  AnyModel,
  ORM,
  Session,
  AttributeClass,
  ForeignKeyClass,
  ManyToManyClass,
  OneToOneClass,
  Attribute,
  ForeignKey,
  ManyToMany,
  OneToOne,
  fk,
  many,
  attr,
  oneToOne,
  createReducer,
  createSelector,
  registerDescriptor,
  Field,
};

export type {
  ModelClassMap,
  ValidateSchema,
  Relations,
  ModelId,
  SessionBoundModel,
  TargetRelationship,
  SourceRelationship,
  ModelFieldMap,
  Ref,
  RefFromFields,
  SessionWithBoundModels,
  OrmState,
  ReduxAction,
  Descriptors,
  ModelClassType,
  OrmSelector,
  Selector,
  AnyObject,
  ModelField,
  RefWithFields,
  DescriptorsMap
}

export default Model;
