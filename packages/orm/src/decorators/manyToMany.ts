import { AnyModel, ModelDescriptorsRegistry } from "../Model";
import { many } from "..";

// The signature should be extended to accept opts
export function ManyToMany(toModelName: string, relatedName?: string | undefined) {
	return function <Target extends AnyModel>(target: Target, propertyName: string): void {
		const model = target.getClass();
		const modelName = model.modelName;
		const registry = ModelDescriptorsRegistry.getInstance();
		const descriptors = registry.getDescriptors(modelName as any);
		if (!descriptors[propertyName]) {
			registry.add(modelName as any, { ...descriptors, [propertyName]: many(toModelName, relatedName) });
		}
	}
}
