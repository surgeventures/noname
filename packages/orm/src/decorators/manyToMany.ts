import { many } from "..";
import { AnyModel } from "../Model";
import { ModelFromModelFields, ModelName, PossibleFieldKeys } from "../types";
import { wrapRegisterDescriptorFn } from "./utils";

export function ManyToMany<MClass extends AnyModel>(
	toModelName: ModelName<ModelFromModelFields<MClass>>, 
	relatedName?: PossibleFieldKeys<MClass, ModelFromModelFields<MClass>>
) {
	const manyDescriptor = wrapRegisterDescriptorFn(many);
	return manyDescriptor(toModelName, relatedName as string);	
}
