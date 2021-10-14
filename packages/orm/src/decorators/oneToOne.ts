import { oneToOne } from "..";
import { AnyModel } from "../Model";
import { ModelFromModelFields, ModelName, PossibleFieldKeys } from "../types";
import { wrapRegisterDescriptorFn } from "./utils";

export function OneToOne<MClass extends AnyModel>(
	toModelName: ModelName<ModelFromModelFields<MClass>>, 
	relatedName?: PossibleFieldKeys<ModelFromModelFields<MClass>>
) {
	const oneToOneDescriptor = wrapRegisterDescriptorFn(oneToOne);
	return oneToOneDescriptor(toModelName, relatedName);
}