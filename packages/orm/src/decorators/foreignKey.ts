import { fk } from "..";
import { AnyModel } from "../Model";
import { ModelFromModelFields, ModelName, PossibleFieldKeys } from "../types";
import { wrapRegisterDescriptorFn } from "./utils";

export function ForeignKey<MClass extends AnyModel>(
	toModelName: ModelName<ModelFromModelFields<MClass>>, 
	relatedName?: PossibleFieldKeys<MClass, ModelFromModelFields<MClass>>
) {
	const fkDescriptor = wrapRegisterDescriptorFn(fk);
	return fkDescriptor(toModelName, relatedName);
}