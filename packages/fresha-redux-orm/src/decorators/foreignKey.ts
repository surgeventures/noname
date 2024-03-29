import { fk } from "..";
import type { ForeignKey as ForeignKeyClass, RelationalFieldOpts } from "../fields";
import { AnyModel } from "../Model";
import { ModelClassTypeFromModelFields, ModelName, PossibleFieldKeys } from "../types";
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
	toModelName: ModelName<ModelClassTypeFromModelFields<MClass>>, 
	relatedName?: PossibleFieldKeys<MClass, ModelClassTypeFromModelFields<MClass>>,
	opts?: Pick<RelationalFieldOpts, 'onDelete'>
) {
	const descriptor = fk(toModelName, relatedName as string, opts);
	
	return registerDescriptor<MClass, AnyModel, ForeignKeyClass>(descriptor);
}