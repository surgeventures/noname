import { Attribute } from '..';
import { AttributeOptions, RelationalFieldOpts } from '../fields';
import { AnyModel } from '../Model';
import { ModelDescriptorsRegistry, Descriptors } from '../modelDescriptorsRegistry';

type AttrsDescriptorFn = (opts: AttributeOptions) => Attribute;
type RegularDescriptorFn<DescriptorTypes extends Exclude<Descriptors, Attribute>> = (toModelName: string, relatedName?: string) => DescriptorTypes;
type ComplexDescriptorFn<DescriptorTypes extends Exclude<Descriptors, Attribute>> = (opts: RelationalFieldOpts) => DescriptorTypes;

type A = (opts: AttributeOptions) => (target: AnyModel, propertyName: string) => void;
type B = (toModelName: string, relatedName?: string) => (target: AnyModel, propertyName: string) => void;
type C = (opts: RelationalFieldOpts) => (target: AnyModel, propertyName: string) => void;

export function wrapRegisterDescriptorFn(descriptorFn: AttrsDescriptorFn): A;
export function wrapRegisterDescriptorFn<DescriptorTypes extends Exclude<Descriptors, Attribute>>(descriptorFn: RegularDescriptorFn<DescriptorTypes>): B;
export function wrapRegisterDescriptorFn<DescriptorTypes extends Exclude<Descriptors, Attribute>>(descriptorFn: ComplexDescriptorFn<DescriptorTypes>): C;
export function wrapRegisterDescriptorFn(descriptorFn: any) {
	function registerDescriptor(arg1: AttributeOptions | RelationalFieldOpts | string, arg2?: string) {
		return function register(target: AnyModel, propertyName: string): void {
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

	return registerDescriptor;
}
