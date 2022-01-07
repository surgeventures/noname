import { attr, Attribute as AttributeClass, AttributeOptions } from "../fields";
import { AnyModel } from "../Model";
import { registerDescriptor } from "./utils";

/**
 * A decorator registering a value attribute on the model.
 * Though not required, it is recommended to define this for each non-foreign key you wish to use.
 * 
 * You can use the optional `getDefault` parameter to fill in unpassed values
 *
 * ```javascript
 * import getUUID from 'your-uuid-package-of-choice';
 *
 *  @Attribute({ getDefault: () => getUUID() })
 *  public id: ModelId;
 * ```
 * 
 * @param opts An object with a default value get function
 */
export function Attribute<MClass extends AnyModel = AnyModel, ValidateAgainst extends any = any>(opts?: AttributeOptions) {
	const descriptor = attr(opts || {});
	
	return registerDescriptor<MClass, ValidateAgainst, AttributeClass>(descriptor);
}
