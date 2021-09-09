import { AnyModel, ModelDescriptorsRegistry } from "../Model";
import { attr } from "..";

// It should be a factory since _attr()_ accepts arguments
export function Attribute<Target extends AnyModel>(target: Target, propertyName: string): void {
	const model = target.getClass();
	const modelName = model.modelName;
	const registry = ModelDescriptorsRegistry.getInstance();
	const descriptors = registry.getDescriptors(modelName as any);
	if (!descriptors[propertyName]) {
		registry.add(modelName as any, { ...descriptors, [propertyName]: attr() });
	}
}
