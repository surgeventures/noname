import { Attribute, AttributeOptions, Field, RelationalFieldOpts } from '../fields';
import { AnyModel } from '../Model';
import { ModelDescriptorsRegistry } from '../ModelDescriptorsRegistry';
import { Descriptors } from '../types';

// Types of accepted descriptors
type CustomAttrWithOptsDescriptorFn = <Opts extends {}>(opts: Opts) => Field;
type AttrsDescriptorFn = (opts: AttributeOptions) => Attribute;
type RelationalFieldDescriptorFn<DescriptorTypes extends Exclude<Descriptors, Attribute>> = (toModelName: string, relatedName?: string) => DescriptorTypes;
type RelationalFieldWithOptsDescriptorFn<DescriptorTypes extends Exclude<Descriptors, Attribute>> = (opts: RelationalFieldOpts) => DescriptorTypes;

type TargetHandler = (target: AnyModel, propertyName: string) => void;

// Types of possible decorator factories
type CustomAttrWithOptsDecoratorFactory = <Opts extends {}>(opts: Opts) => TargetHandler;
type AttrDecoratorFactory = (opts: AttributeOptions) => TargetHandler;
type RelationalFieldDecoratorFactory = (toModelName: string, relatedName?: string) => TargetHandler;
type RelationalFieldWithOptsDecoratorFactory = (opts: RelationalFieldOpts) => TargetHandler;

export function registerDescriptor(descriptorFn: AttrsDescriptorFn): AttrDecoratorFactory;
export function registerDescriptor<DescriptorTypes extends Exclude<Descriptors, Attribute>>(descriptorFn: RelationalFieldDescriptorFn<DescriptorTypes>): RelationalFieldDecoratorFactory;
export function registerDescriptor<DescriptorTypes extends Exclude<Descriptors, Attribute>>(descriptorFn: RelationalFieldWithOptsDescriptorFn<DescriptorTypes>): RelationalFieldWithOptsDecoratorFactory;
export function registerDescriptor(descriptorFn: CustomAttrWithOptsDescriptorFn): CustomAttrWithOptsDecoratorFactory;
export function registerDescriptor(descriptorFn: any) {
	function decoratorFactory(arg1: AttributeOptions | RelationalFieldOpts | string | {}, arg2?: string) {
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
