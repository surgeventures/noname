import { oneToOne } from "..";
import type { OneToOne as OneToOneClass } from "../fields";
import { AnyModel } from "../Model";
import { ModelClassTypeFromModelFields, ModelName, PossibleFieldKeys } from "../types";
import { registerDescriptor } from "./utils";

/**
 * A decorator registering a one-to-one relationship. In database terms, this is a foreign key with the
 * added restriction that only one entity can point to single target entity.
 *
 * If `relatedName` is not supplied, the source model name in lowercase will be used. 
 * Note that with the one-to-one relationship, the `relatedName` should be in singular, not plural.
 * 
 * @param toModelName The model name you want to define a relation to.
 * @param relatedName The name of key, you want to create backwards relation for.
 */
export function OneToOne<MClass extends AnyModel>(
	toModelName: ModelName<ModelClassTypeFromModelFields<MClass>>, 
	relatedName?: PossibleFieldKeys<MClass, ModelClassTypeFromModelFields<MClass>>
) {
	const descriptor = oneToOne(toModelName, relatedName as string);
	
	return registerDescriptor<MClass, AnyModel, OneToOneClass>(descriptor);
}
