import { Field } from '../fields';
import { AnyModel } from '../Model';
import { ModelDescriptorsRegistry } from '../modelDescriptorsRegistry';
import { RefWithFields, ValidateDecoratedField } from '../types';

/**
 * Encapsulates the logic responsible for registering fields descriptors to the registry.
 * 
 * @param descriptor Any descriptor class that extends {@link Field}
 * @returns A function to decorate the field
 */
export function registerDescriptor<MClass extends AnyModel, ValidateAgainst extends any, Descriptor extends Field>(descriptor: Descriptor) {
	return function decorate<
		PropName extends keyof RefWithFields<MClass>
	>(target: ValidateDecoratedField<MClass, PropName, ValidateAgainst>, propertyName: PropName): void {
		const model = target.getClass();
		const modelName = model.modelName;
		const registry = ModelDescriptorsRegistry.getInstance();
		const descriptors = registry.getDescriptors(modelName);
		if (!descriptors[propertyName as string]) {
			registry.add(modelName, { ...descriptors, [propertyName]: descriptor });
		}
	}
}
