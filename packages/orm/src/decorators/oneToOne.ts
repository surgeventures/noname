import { oneToOne } from "..";
import { wrapRegisterDescriptorFn } from "./utils";

export function OneToOne(toModelName: string, relatedName?: string | undefined) {
	const oneToOneDescriptor = wrapRegisterDescriptorFn(oneToOne);
	return oneToOneDescriptor(toModelName, relatedName);
}