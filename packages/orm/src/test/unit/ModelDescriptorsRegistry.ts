import { attr } from "../..";
import { ModelDescriptorsRegistry } from "../../ModelDescriptorsRegistry";

const modelName = 'Test';

function addDescriptorsForTest(registry: ModelDescriptorsRegistry) {
	registry.add(modelName, { id: attr(), testProp: attr() });
}

describe("ModelDescriptorsRegistry", () => {
	const registry = ModelDescriptorsRegistry.getInstance();

	beforeEach(() => {
		registry.clear();
	});
	afterAll(() =>{
		registry.clear();
	})

	it("returns the same instance", () => {
		expect(registry).toBe(ModelDescriptorsRegistry.getInstance())
	});

	it("clears the registry", () => {
		addDescriptorsForTest(registry);	
		expect(Object.keys(registry.getRegistry())).toHaveLength(1);

		registry.clear();
		expect(Object.keys(registry.getRegistry())).toHaveLength(0);
	});

	it("adds descriptors to a given model name", () => {
		addDescriptorsForTest(registry);	
		expect(registry.getRegistry()).toMatchInlineSnapshot();
	});

	it("gets descriptors by a given model name", () => {
		addDescriptorsForTest(registry);
		expect(registry.getDescriptors(modelName)).toMatchInlineSnapshot();
	});

	it("gets descriptors with defaults for a given model name", () => {
		expect(registry.getDescriptors(modelName)).toMatchInlineSnapshot();
	});
});
