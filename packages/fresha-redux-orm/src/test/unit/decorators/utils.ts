import { registerDescriptor } from "../../../decorators/utils";
import { Attribute, ManyToMany, AttributeOptions, RelationalFieldOpts, RelationalField } from "../../../fields";
import Model, { AnyModel } from "../../../Model";
import { ModelDescriptorsRegistry } from "../../../modelDescriptorsRegistry";

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

		class TestRelationalFieldDescriptor extends ManyToMany {}
		
		const relationalFieldDescriptorFnMock = jest.fn((modelName: string, relatedName?: string, opts?: { onDelete?: 'CASCADE' }) => new TestRelationalFieldDescriptor(modelName, relatedName, opts));
		const relationalFieldDescriptorFnWithOptsMock = jest.fn((opts: RelationalFieldOpts) => new TestRelationalFieldDescriptor(opts));
		
		afterEach(() =>{
			registry.clear();
			jest.clearAllMocks();
		})
	
		it("decorator registers the attr descriptor using no options", () => {
			const opts: AttributeOptions = {};
			const decorator = registerDescriptor<AnyModel, any, TestAttributeDescriptor>(attrDescriptorFnStub(opts));
	
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
			const decorator = registerDescriptor<AnyModel, any, TestAttributeDescriptor>(attrDescriptorFnStub(opts));
			
			decorator(new Test({}), fieldName);

			expect(attrDescriptorFnStub).toHaveBeenCalledTimes(1);
			expect(attrDescriptorFnStub).toHaveBeenCalledWith(opts);
			expect(registry.getDescriptors(modelName)[fieldName]).toBeInstanceOf(TestAttributeDescriptor);
		});

		it("decorator registers the relational field descriptor using passed strings", () => {
			const onDeleteMethod = 'CASCADE';
			const opts = {
				onDelete: onDeleteMethod
			} as const;
			const decorator = registerDescriptor<AnyModel, any, TestRelationalFieldDescriptor>(relationalFieldDescriptorFnMock(modelName, fieldName, opts));
	
			decorator(new Test({}), fieldName);

			const descriptor = registry.getDescriptors(modelName)[fieldName] as RelationalField;

			expect(relationalFieldDescriptorFnMock).toHaveBeenCalledTimes(1);
			expect(relationalFieldDescriptorFnMock).toHaveBeenCalledWith(modelName, fieldName, opts);
			expect(descriptor).toBeInstanceOf(TestRelationalFieldDescriptor);
			expect(descriptor.onDelete).toEqual(onDeleteMethod);
		});

		it("decorator registers the relational field descriptor using options", () => {
			const onDeleteMethod = 'CASCADE';
			const opts: RelationalFieldOpts = {
				to: 'modelName',
				relatedName: 'foreignKey',
				onDelete: onDeleteMethod
			};
			const decorator = registerDescriptor<AnyModel, any, TestRelationalFieldDescriptor>(relationalFieldDescriptorFnWithOptsMock(opts));
	
			decorator(new Test({}), fieldName);

			const descriptor = registry.getDescriptors(modelName)[fieldName] as RelationalField;

			expect(relationalFieldDescriptorFnWithOptsMock).toHaveBeenCalledTimes(1);
			expect(relationalFieldDescriptorFnWithOptsMock).toHaveBeenCalledWith(opts);
			expect(registry.getDescriptors(modelName)[fieldName]).toBeInstanceOf(TestRelationalFieldDescriptor);
			expect(descriptor.onDelete).toEqual(onDeleteMethod);
		});
	})
});