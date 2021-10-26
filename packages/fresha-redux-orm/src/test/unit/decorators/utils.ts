import { registerDescriptor } from "../../../decorators/utils";
import { Attribute, ManyToMany, AttributeOptions, RelationalFieldOpts } from "../../../fields";
import Model from "../../../Model";
import { ModelDescriptorsRegistry } from "../../../ModelDescriptorsRegistry";

const registry = ModelDescriptorsRegistry.getInstance();

describe("utils", () => {
	describe('registerDescriptor', () => {
		registry.clear();
		
		const modelName = 'Test';
		const fieldName = 'test';
		class Test extends Model<typeof Test> {
			static readonly modelName = modelName;
		}
	
		class TestAttributeDescriptor extends Attribute {}
		const attrDescriptorFnStub = jest.fn((opts?: AttributeOptions) => new TestAttributeDescriptor(opts));
		const attrDecoratorFactory = registerDescriptor(attrDescriptorFnStub);

		class TestRelationalFieldDescriptor extends ManyToMany {}
		
		const relationalFieldDescriptorFnMock = jest.fn((modelName: string, relatedName?: string) => new TestRelationalFieldDescriptor(modelName, relatedName));
		const relationalFieldDescriptorFnWithOptsMock = jest.fn((opts: RelationalFieldOpts) => new TestRelationalFieldDescriptor(opts));
		
		const relationalFieldDecoratorFactory = registerDescriptor(relationalFieldDescriptorFnMock);
		const relationalFieldDecoratorWithOptsFactory = registerDescriptor(relationalFieldDescriptorFnWithOptsMock);

		afterEach(() =>{
			registry.clear();
			jest.clearAllMocks();
		})
	
		it("decorator registers the attr descriptor using no options", () => {
			const opts: AttributeOptions = {};
			const decorator = attrDecoratorFactory(opts);
	
			decorator(new Test({}), fieldName);
			
			expect(attrDescriptorFnStub).toHaveBeenCalledTimes(1);
			expect(attrDescriptorFnStub).toHaveBeenCalledWith(opts);
			expect(registry.getDescriptors(modelName)[fieldName]).toBeInstanceOf(TestAttributeDescriptor);
		});
		
		it("decorator registers the attr descriptor using a custom default getter", () => {
			const getDefault = () => 'uuid';
			const opts: AttributeOptions = {
				getDefault,
			};
			const decorator = attrDecoratorFactory(opts);
			
			decorator(new Test({}), fieldName);

			expect(attrDescriptorFnStub).toHaveBeenCalledTimes(1);
			expect(attrDescriptorFnStub).toHaveBeenCalledWith(opts);
			expect(registry.getDescriptors(modelName)[fieldName]).toBeInstanceOf(TestAttributeDescriptor);
		});

		it("decorator registers the relational field descriptor using passed strings", () => {
			const decorator = relationalFieldDecoratorFactory(modelName, fieldName);
	
			decorator(new Test({}), fieldName);

			expect(relationalFieldDescriptorFnMock).toHaveBeenCalledTimes(1);
			expect(relationalFieldDescriptorFnMock).toHaveBeenCalledWith(modelName, fieldName);
			expect(registry.getDescriptors(modelName)[fieldName]).toBeInstanceOf(TestRelationalFieldDescriptor);
		});

		it("decorator registers the relational field descriptor using options", () => {
			const opts: RelationalFieldOpts = {
				to: 'modelName',
				relatedName: 'foreignKey' 
			};
			const decorator = relationalFieldDecoratorWithOptsFactory(opts);
	
			decorator(new Test({}), fieldName);

			expect(relationalFieldDescriptorFnWithOptsMock).toHaveBeenCalledTimes(1);
			expect(relationalFieldDescriptorFnWithOptsMock).toHaveBeenCalledWith(opts);
			expect(registry.getDescriptors(modelName)[fieldName]).toBeInstanceOf(TestRelationalFieldDescriptor);
		});
	})
});