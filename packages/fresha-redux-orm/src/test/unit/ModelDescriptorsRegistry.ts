import Model, { attr, Attribute, ModelId } from "../..";
import { Attribute as AttributeClass } from "../../fields";
import { getDescriptors, ModelDescriptorsRegistry } from "../../ModelDescriptorsRegistry";

const modelName = 'Test';

function addDescriptorsForTest(registry: ModelDescriptorsRegistry) {
	registry.add(modelName, { id: attr(), testProp: attr() });
}

describe("ModelDescriptorsRegistry", () => {
	const registry = ModelDescriptorsRegistry.getInstance();
	registry.clear();

	afterEach(() =>{
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

	it('enables to add descriptors with overwritten defaults', () => {
		const descriptors = registry.getDescriptors(modelName);
		expect(descriptors).toEqual({});

		const getDefault = () => 'uuid';
		registry.add(modelName, { id: attr({ getDefault }) });

		const AttrClass = registry.getDescriptors(modelName).id;
		expect(AttrClass.getDefault!()).toEqual(getDefault());
	})
});

describe("utils", () => {
	const registry = ModelDescriptorsRegistry.getInstance();
	registry.clear();

	const createTestModelWithStaticFields = () => {
		class Test extends Model<typeof Test, {}> {
			static readonly = "Test";
			
			static fields = {
				id: attr(),
				name: attr(),
			}
		}

		return { Test };
	}

	const createTestModelWithDecorators = () => {
		class Test extends Model<typeof Test, {}> {
			static readonly = "Test";

			@Attribute()
			public id: ModelId;

			@Attribute()
			public name: string;
		}

		return { Test };
	}

	const createTestModelWithoutDescriptors = () => {
		class Test extends Model<typeof Test, {}> {
			static readonly = "Test";
		}

		return { Test };	
	}

	afterEach(() =>{
		registry.clear();
	})

	it("gets descriptors from the static fields object", () => {
		const { Test } = createTestModelWithStaticFields()
		const descriptors = getDescriptors(registry, Test);

		expect(descriptors.id).toBeInstanceOf(AttributeClass);
		expect(descriptors.name).toBeInstanceOf(AttributeClass);
	})

	it("gets descriptors from the registry", () => {
		const { Test } = createTestModelWithDecorators()
		const descriptors = getDescriptors(registry, Test);

		expect(descriptors.id).toBeInstanceOf(AttributeClass);
		expect(descriptors.name).toBeInstanceOf(AttributeClass);
	})

	it("gets descriptors from the default static fields object", () => {
		const { Test } = createTestModelWithoutDescriptors()
		const descriptors = getDescriptors(registry, Test);

		expect(descriptors.id).toBeInstanceOf(AttributeClass);
	})
})