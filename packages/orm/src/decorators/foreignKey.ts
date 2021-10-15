import { fk } from "..";
import { AnyModel } from "../Model";
import { ModelFromModelFields, ModelName, PossibleFieldKeys } from "../types";
import { registerDescriptor } from "./utils";

/**
 * A decorator that registers a foreign key on a model, which points
 * to a single entity on another model.
 *
 * The first argument is the name
 * of the Model the foreign key is pointing to, and
 * the second one is an optional related name, which will
 * be used to access the Model the foreign key
 * is being defined from, from the target Model.
 *
 * If the related name is not passed, it will be set as
 * `${toModelName}Set`.
 * 
 * @param toModelName The model name you want to define a relation to.
 * @param relatedName The name of foreign key, you want to create backwards relation for.
 */
export function ForeignKey<MClass extends AnyModel>(
	toModelName: ModelName<ModelFromModelFields<MClass>>, 
	relatedName?: PossibleFieldKeys<MClass, ModelFromModelFields<MClass>>
) {
	const fkDescriptor = registerDescriptor(fk);
	return fkDescriptor(toModelName, relatedName as string);
}