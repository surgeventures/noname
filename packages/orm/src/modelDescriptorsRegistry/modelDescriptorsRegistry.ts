import { attr, Attribute, OneToOne, ManyToMany, ForeignKey } from "..";

export type Descriptors = Attribute | OneToOne | ManyToMany | ForeignKey;
type DescriptorsMap<DescriptorTypes extends Descriptors> = { id: Attribute } & { [K: string]: DescriptorTypes }

type Registry<DescriptorTypes extends Descriptors = Descriptors> = { [K: string]: DescriptorsMap<DescriptorTypes> };

export class ModelDescriptorsRegistry {
  private static instance: ModelDescriptorsRegistry;
  public registry: Registry = {} as Registry;

  private constructor() { }

  public static getInstance(): ModelDescriptorsRegistry {
      if (!ModelDescriptorsRegistry.instance) {
        ModelDescriptorsRegistry.instance = new ModelDescriptorsRegistry();
      }

      return ModelDescriptorsRegistry.instance;
  }

  public add<K extends string>(modelName: K, descriptors: Registry[K]): void {
    this.registry[modelName] = descriptors;
  }

  public getDescriptors(modelName: string) {
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
    this.registry = {} as Registry;
  }
}