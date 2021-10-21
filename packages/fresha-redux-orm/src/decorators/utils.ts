import { Attribute, AttributeOptions, RelationalFieldOpts } from '../fields';
import { AnyModel } from '../Model';
import { ModelDescriptorsRegistry } from '../ModelDescriptorsRegistry';
import { Descriptors } from '../types';

// Types of accepted descriptors
type AttrsDescriptorFn = (opts: AttributeOptions) => Attribute;
type BasicRelationalFieldDescriptorFn<DescriptorTypes extends Exclude<Descriptors, Attribute>> = (toModelName: string, relatedName?: string) => DescriptorTypes;
type ComplexRelationalFieldDescriptorFn<DescriptorTypes extends Exclude<Descriptors, Attribute>> = (opts: RelationalFieldOpts) => DescriptorTypes;

type TargetHandler = (target: AnyModel, propertyName: string) => void;

// Types of possible decorator factories
type AttrDecoratorFactory = (opts: AttributeOptions) => TargetHandler;
type BasicRelationalFieldDecoratorFactory = (toModelName: string, relatedName?: string) => TargetHandler;
type ComplexRelationalFieldDecoratorFactory = (opts: RelationalFieldOpts) => TargetHandler;

export function registerDescriptor(descriptorFn: AttrsDescriptorFn): AttrDecoratorFactory;
export function registerDescriptor<DescriptorTypes extends Exclude<Descriptors, Attribute>>(descriptorFn: BasicRelationalFieldDescriptorFn<DescriptorTypes>): BasicRelationalFieldDecoratorFactory;
export function registerDescriptor<DescriptorTypes extends Exclude<Descriptors, Attribute>>(descriptorFn: ComplexRelationalFieldDescriptorFn<DescriptorTypes>): ComplexRelationalFieldDecoratorFactory;
export function registerDescriptor(descriptorFn: any) {
	function decoratorFactory(arg1: AttributeOptions | RelationalFieldOpts | string, arg2?: string) {
		return function target(target: AnyModel, propertyName: string): void {
			const model = target.getClass();
			const modelName = model.modelName;
			const registry = ModelDescriptorsRegistry.getInstance();
			const descriptors = registry.getDescriptors(modelName);
			if (!descriptors[propertyName]) {
				const fn = typeof arg1 === 'string' ? descriptorFn(arg1, arg2) as Attribute : descriptorFn(arg1) as Exclude<Descriptors, Attribute>;
				registry.add(modelName, { ...descriptors, [propertyName]: fn });
			}
		}
	}

	return decoratorFactory;
}
