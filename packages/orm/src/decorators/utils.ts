import { ModelClassMap } from '../Model';
import { ModelDescriptorsRegistry, Descriptors } from '../modelDescriptorsRegistry';

type DescriptorFn<DescriptorTypes extends Descriptors> = (toModelName: string, relatedName?: string | undefined) => DescriptorTypes;

type ModelNames<Schema extends ModelClassMap> = Extract<keyof Schema, Schema[keyof Schema]['modelName']>;
type Models<Schema extends ModelClassMap> = InstanceType<Schema[ModelNames<Schema>]>;


export function wrapRegisterDescriptorFn<DescriptorTypes extends Descriptors>(descriptorFn: DescriptorFn<DescriptorTypes>) {
	return function registerDescriptor<Schema extends ModelClassMap, MClassName extends ModelNames<Schema>>(toModelName: MClassName, relatedName?: string) {
		return function register<Schema extends ModelClassMap, MClasses extends Models<Schema>>(target: MClasses, propertyName: string): void {
			const model = target.getClass();
			const modelName = model.modelName;
			const registry = ModelDescriptorsRegistry.getInstance();
			const descriptors = registry.getDescriptors(modelName);
			if (!descriptors[propertyName]) {
				registry.add(modelName, { ...descriptors, [propertyName]: descriptorFn(toModelName, relatedName) });
			}
		}
	}
}
