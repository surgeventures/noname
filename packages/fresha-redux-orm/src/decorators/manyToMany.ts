import { many } from "..";
import type { ManyToMany as ManyToManyClass, RelationalFieldOpts } from "../fields";
import { AnyModel } from "../Model";
import QuerySet from "../QuerySet";
import { ModelClassTypeFromModelFields, ModelName, PossibleFieldKeys } from "../types";
import { registerDescriptor } from "./utils";

/**
 * A decorator that registers a many-to-many relationship between
 * this (source) and another (target) model.
 *
 * The first argument is the name
 * of the Model the key is pointing to, and
 * the second one is an optional related name, which will
 * be used to access the Model the key
 * is being defined from, from the target Model.
 *
 * If the related name is not passed, it will be set as
 * `${toModelName}Set`.
 * 
 * @param toModelName The model name you want to define a relation to.
 * @param relatedName The name of key, you want to create backwards relation for.
 */
export function ManyToMany<MClass extends AnyModel>(
	toModelName: ModelName<ModelClassTypeFromModelFields<MClass>>, 
	relatedName?: PossibleFieldKeys<MClass, ModelClassTypeFromModelFields<MClass>>,
	opts?: Pick<RelationalFieldOpts, 'onDelete'>
) {
	const descriptor = many(toModelName, relatedName as string, opts);
	
	return registerDescriptor<MClass, QuerySet, ManyToManyClass>(descriptor);
}
