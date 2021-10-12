import { ModelClassMap } from "../Model";
import { attr, Attribute, OneToOne, ManyToMany, ForeignKey } from "..";

export type Descriptors = Attribute | OneToOne | ManyToMany | ForeignKey;
type DescriptorsMap<DescriptorTypes extends Descriptors> = { id: Attribute } & { [K: string]: DescriptorTypes }

type Registry<
    Schema extends ModelClassMap,
    DescriptorTypes extends Descriptors = Descriptors,
    Models extends keyof Schema = Extract<keyof Schema, Schema[keyof Schema]['modelName']>,
> = { [Model in Models]: DescriptorsMap<DescriptorTypes> };

export class ModelDescriptorsRegistry<Schema extends ModelClassMap> {
  private static instance: ModelDescriptorsRegistry<any>;
  public registry: Registry<Schema> = {} as Registry<Schema>;

  private constructor() { }

  public static getInstance<Schema extends ModelClassMap>(): ModelDescriptorsRegistry<Schema> {
      if (!ModelDescriptorsRegistry.instance) {
        ModelDescriptorsRegistry.instance = new ModelDescriptorsRegistry();
      }

      return ModelDescriptorsRegistry.instance as ModelDescriptorsRegistry<Schema>;
  }

  public add(modelName: keyof Registry<Schema>, descriptors: Registry<Schema>[keyof Registry<Schema>]): void {
    this.registry[modelName] = descriptors;
  }

  public getDescriptors(modelName: keyof Registry<Schema>) {
    const descriptors = this.registry[modelName];
    if (!descriptors) {
      this.add(modelName, this.getDefaultDescriptors());
      return this.registry[modelName];
    }
    return descriptors;
  }

  public getDefaultDescriptors() {
    return { id: attr() };
  }

  public clear(): void {
    this.registry = {} as Registry<Schema>;
  }
}