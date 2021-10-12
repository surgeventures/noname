import { fk } from "..";
import { wrapRegisterDescriptorFn } from "./utils";

export function ForeignKey(toModelName: string, relatedName?: string | undefined) {
	const fkDescriptor = wrapRegisterDescriptorFn(fk);
	return fkDescriptor(toModelName, relatedName);
}