import { ModelDescriptorsRegistry } from "./modelDescriptorsRegistry";
import { AnyModel } from "../Model";
import { DescriptorsMap } from "./types";
import { Descriptors } from "../types";

/**
 * A function providing the backwards compatibility for static fields object.
 * 
 * @param registry The registry service
 * @param model The model we want to get descriptors for
 * @returns An object with descriptors for given model
 */
export function getDescriptors(registry: ModelDescriptorsRegistry, model: typeof AnyModel): DescriptorsMap<Descriptors> {
  const modelName = model.modelName;
  const descriptors = registry.getDescriptors(modelName);
	const noDescriptorsFromRegistry = Object.keys(descriptors).length === 0;

	if (noDescriptorsFromRegistry) {
		const fields = model.fields;
		if (!fields) {
			throw new Error(`Both fields object and descriptors in registry are not available for ${modelName} model.`)
		}
		return fields;
	}

	return descriptors;
}