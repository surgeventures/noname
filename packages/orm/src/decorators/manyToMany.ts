import { many } from "..";
import { wrapRegisterDescriptorFn } from "./utils";

export function ManyToMany(toModelName: string, relatedName?: string | undefined) {
	const manyDescriptor = wrapRegisterDescriptorFn(many);
	return manyDescriptor(toModelName, relatedName);	
}
