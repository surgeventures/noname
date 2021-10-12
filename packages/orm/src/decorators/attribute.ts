import { attr } from "..";
import { AttributeOptions } from "../fields";
import { wrapRegisterDescriptorFn } from "./utils";

export function Attribute(opts?: AttributeOptions): void {
	const attrDescriptor = wrapRegisterDescriptorFn(attr);
	return attrDescriptor(opts);
}
