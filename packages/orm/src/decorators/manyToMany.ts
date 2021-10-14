import { many } from "..";
import { AnyModel } from "../Model";
import { ModelFromModelFields, ModelName, PossibleFieldKeys } from "../types";
import { wrapRegisterDescriptorFn } from "./utils";

export function ManyToMany<
	MClass extends AnyModel, 
	MClassTypeFromFields extends ModelFromModelFields<MClass> = ModelFromModelFields<MClass>,
	MName extends ModelName<MClassTypeFromFields> = ModelName<MClassTypeFromFields>,
	FKey extends PossibleFieldKeys<MClassTypeFromFields> = PossibleFieldKeys<MClassTypeFromFields>,
>(toModelName: MName, relatedName: FKey) {
	const manyDescriptor = wrapRegisterDescriptorFn(many);
	return manyDescriptor(toModelName, relatedName);	
}
