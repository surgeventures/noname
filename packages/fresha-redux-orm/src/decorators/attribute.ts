import { attr, AttributeOptions } from "../fields";
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
export function Attribute(opts?: AttributeOptions) {
	const attrDescriptor = registerDescriptor(attr);
	return attrDescriptor(opts || {});
}
