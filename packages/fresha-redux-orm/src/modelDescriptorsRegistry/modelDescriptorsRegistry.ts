import { attr, Attribute } from "../fields";
import { Descriptors } from '../types';

/**
 * Represents a map with descriptors for a specific model
 */
type DescriptorsMap<DescriptorTypes extends Descriptors> = { id: Attribute } & { [DescriptorName: string]: DescriptorTypes }
/**
 * Stores descriptors maps for each registered model
 */
type Registry<DescriptorTypes extends Descriptors = Descriptors> = { [ModelName: string]: DescriptorsMap<DescriptorTypes> };

/**
 * A singleton storing descriptors for each registered model.
 */
export class ModelDescriptorsRegistry {
  private static instance: ModelDescriptorsRegistry;
  private registry: Registry = {} as Registry;

  private constructor() { }

  public static getInstance(): ModelDescriptorsRegistry {
      if (!ModelDescriptorsRegistry.instance) {
        ModelDescriptorsRegistry.instance = new ModelDescriptorsRegistry();
      }

      return ModelDescriptorsRegistry.instance;
  }

  public add<K extends string>(modelName: K, descriptors: Registry[K]): void {
    const defaultDescriptors = this.getDefaultDescriptors();
    this.registry[modelName] = { ...defaultDescriptors, ...descriptors };
  }

  public getDescriptors(modelName: string) {
    const descriptors = this.registry[modelName];
    return descriptors || {};
  }

  private getDefaultDescriptors() {
    return { id: attr() };
  }

  public getRegistry(): Readonly<Registry> {
    return this.registry;
  }

  public clear(): void {
    this.registry = {} as Registry;
  }
}