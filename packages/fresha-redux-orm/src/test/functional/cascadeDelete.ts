import Model, { ModelId, TargetRelationship, Relations, Attribute, ForeignKey, SourceRelationship, OneToOne, ManyToMany, ValidateSchema, SessionWithBoundModels, ORM, ModelDescriptorsRegistry } from "../..";
import { attr, fk, many, oneToOne } from "../../fields";

const registry = ModelDescriptorsRegistry.getInstance();

const getModelClassesWithDecorators = () => {
	type YellowDescriptors = {
		id: ModelId;
		name?: string;
		blue?: TargetRelationship<Blue, Relations.ForeignKey>
	}
	class Yellow extends Model<typeof Yellow, YellowDescriptors> {
		static modelName = "Yellow" as const;

		@Attribute()
		public id: ModelId;

		@Attribute()
		public name: string;

		@ForeignKey<Yellow>('Blue', 'yellows', { onDelete: 'CASCADE' })
		public blue: TargetRelationship<Blue, Relations.ForeignKey>
	}

	type BlueDescriptors = {
		id: ModelId;
		name?: string;
		yellows?: SourceRelationship<typeof Yellow, Relations.ForeignKey>;
		greens?: SourceRelationship<typeof Green, Relations.ManyToMany>;
	}
	class Blue extends Model<typeof Blue, BlueDescriptors> {
		static modelName = "Blue" as const;

		@Attribute()
		public id: ModelId;

		@Attribute()
		public name: string;

		public yellows: SourceRelationship<typeof Yellow, Relations.ForeignKey>;
		public greens: SourceRelationship<typeof Green, Relations.ManyToMany>;
	}

	type GreenDescriptors = {
		id: ModelId;
		name?: string;
		cascadeRed?: TargetRelationship<Red, Relations.OneToOne>;
		red?: TargetRelationship<Red, Relations.OneToOne>;
		blues?: TargetRelationship<Blue, Relations.ManyToMany>;
	}
	class Green extends Model<typeof Green, GreenDescriptors> {
		static modelName = "Green" as const;

		@Attribute()
		public id: ModelId;

		@Attribute()
		public name: string;

		@OneToOne<Green>('Red', 'cascadeGreen', { onDelete: 'CASCADE' })
		public cascadeRed: TargetRelationship<Red, Relations.OneToOne>;

		@OneToOne<Green>('Red', 'green')
		public red: TargetRelationship<Red, Relations.OneToOne>;

		@ManyToMany<Green>('Blue', 'greens', { onDelete: 'CASCADE' })
		public blues: TargetRelationship<Blue, Relations.ManyToMany>;
	}

	type RedDescriptors = {
		id: ModelId;
		name?: string;
		cascadeTargetReds?: TargetRelationship<Red, Relations.ManyToMany>;
		cascadeSourceReds?: SourceRelationship<typeof Red, Relations.ManyToMany>;
		targetReds?: TargetRelationship<Red, Relations.ManyToMany>;
		sourceReds?: SourceRelationship<typeof Red, Relations.ManyToMany>;
		cascadeGreen?: SourceRelationship<typeof Green, Relations.OneToOne>;
		green?: SourceRelationship<typeof Green, Relations.OneToOne>;
	}
	class Red extends Model<typeof Red, RedDescriptors> {
		static modelName = "Red" as const;

		@Attribute()
		public id: ModelId;

		@Attribute()
		public name: string;

		@ManyToMany<Red>('Red', 'sourceReds')
		public targetReds: TargetRelationship<Red, Relations.ManyToMany>;

		@ManyToMany<Red>('Red', 'cascadeSourceReds', { onDelete: 'CASCADE' })
		public cascadeTargetReds: TargetRelationship<Red, Relations.ManyToMany>;

		public cascadeSourceReds: SourceRelationship<typeof Red, Relations.ManyToMany>;
		public sourceReds: SourceRelationship<typeof Red, Relations.ManyToMany>;
		public cascadeGreen: SourceRelationship<typeof Green, Relations.OneToOne>;
		public green: SourceRelationship<typeof Green, Relations.OneToOne>;
	}
	
	return { Yellow, Blue, Green, Red };
};

type Schema = ValidateSchema<{
	Yellow: ReturnType<typeof getModelClassesWithDecorators>['Yellow'];
	Blue: ReturnType<typeof getModelClassesWithDecorators>['Blue'];
	Red: ReturnType<typeof getModelClassesWithDecorators>['Red'];
	Green: ReturnType<typeof getModelClassesWithDecorators>['Green'];
}>;

describe('cascading delete - decorators', () => {
	let session: SessionWithBoundModels<Schema>;

	beforeEach(() => {
		registry.clear();
		const { Yellow, Blue, Red, Green } = getModelClassesWithDecorators();
		const orm = new ORM<Schema>();
		orm.register(Yellow, Blue, Red, Green);
		session = orm.session();
	});

	describe('single instance', () => {
		it("does not remove referenced entities in self-referencing relationship if not using cascade delete", () => {
			const red = session.Red.create({ id: "1" });
			session.Red.create({ id: "2", targetReds: [red] });
	
			red.delete();
	
			expect(session.Red.withId("1")).toBe(null);
			expect(session.Red.withId("2")).not.toBe(null);
		});
	
		it("removes referenced entities in self-referencing relationship if using cascade delete", () => {
			const red = session.Red.create({ id: "1" });
			session.Red.create({ id: "2", cascadeTargetReds: [red] });
	
			red.delete();
	
			expect(session.Red.count()).toBe(0);
		});
	
		it("removes referenced entities in self-referencing relationship if the parent entity has foreign keys using cascade delete and the default delete mode", () => {
			const red = session.Red.create({ id: "1" });
			session.Red.create({ id: "2", targetReds: [red] });
			session.Red.create({ id: "3", cascadeTargetReds: [red] });
	
			red.delete();
	
			expect(session.Red.count()).toBe(1);
			expect(session.Red.withId('2')).not.toBe(null);
		});
	
		it("does not remove referenced entities if removing relationships parent", () => {
			const red = session.Red.create({ id: "1" });
			const blue1 = session.Blue.create({ id: "3" });
			const blue2 = session.Blue.create({ id: "4" });
			const green = session.Green.create({ id: "11", red, blues: [blue1, blue2] });
	
			green.delete();
	
			expect(session.Red.count()).toBe(1);
			expect(session.Blue.count()).toBe(2);
			expect(session.Green.count()).toBe(0);
		});
	
		it("skips cascading removing entities that are not linked", () => {
			const yellow = session.Yellow.create({ id: "1" });
			const blue = session.Blue.create({ id: "2" });
			const green = session.Green.create({ id: "3" });
			const red1 = session.Red.create({ id: "4" });
			const red2 = session.Red.create({ id: "5" });
			
			yellow.delete();
	
			expect(session.Yellow.count()).toBe(0);
			expect(session.Blue.count()).toBe(1);
			expect(session.Green.count()).toBe(1);
			expect(session.Red.count()).toBe(2);
	
			blue.delete();
	
			expect(session.Blue.count()).toBe(0);
			expect(session.Green.count()).toBe(1);
			expect(session.Red.count()).toBe(2);
	
			green.delete();
	
			expect(session.Green.count()).toBe(0);
			expect(session.Red.count()).toBe(2);
	
			red1.delete();
	
			expect(session.Red.count()).toBe(1);
	
			red2.delete();
	
			expect(session.Red.count()).toBe(0);
		});
	
		it("removes referenced entities using 1-N and N-M relation that have cascade delete option on", () => {
			const blue = session.Blue.create({ id: "1" });
			session.Yellow.create({ id: "2", blue });
			session.Green.create({ id: "3", blues: [blue] });
			session.Green.create({ id: "4" });
	
			blue.delete();
	
			expect(session.Yellow.count()).toBe(0);
			expect(session.Blue.count()).toBe(0);
			expect(session.Green.count()).toBe(1);
			expect(session.Green.withId('4')).not.toBe(null);
		});

		it("removes referenced entities using 1-1 relation that have cascade delete option on", () => {
			const red = session.Red.create({ id: "1" });
			session.Green.create({ id: "4", cascadeRed: red });
	
			red.delete();
	
			expect(session.Red.count()).toBe(0);
			expect(session.Green.count()).toBe(0);
		});
	});

	describe('query set', () => {
		it("removes referenced entities using 1-N and N-M relation that have cascade delete option on", () => {
			const blue1 = session.Blue.create({ id: "1" });
			const blue2 = session.Blue.create({ id: "11" });
			session.Yellow.create({ id: "2", blue: blue1 });
			session.Green.create({ id: "3", blues: [blue1, blue2] });
			session.Green.create({ id: "4" });
	
			session.Blue.all().delete();
	
			expect(session.Yellow.count()).toBe(0);
			expect(session.Blue.count()).toBe(0);
			expect(session.Green.count()).toBe(1);
			expect(session.Green.withId('4')).not.toBe(null);
		});

		it("removes referenced entities using 1-1 relation and others that have cascade delete option on", () => {
			const red1 = session.Red.create({ id: "1", name: 'red' });
			const red2 = session.Red.create({ id: "2", name: 'red' });
			session.Green.create({ id: "3", name: 'greenName', cascadeRed: red1 });
			session.Green.create({ id: "4", name: 'greenName', cascadeRed: red2 });
	
			session.Red.all().delete();
	
			expect(session.Red.count()).toBe(0);
			expect(session.Green.count()).toBe(0);
		});
	});	
});

describe('cascading delete - static fields', () => {
	const getModelClasses = () => {
		type YellowDescriptors = {
			id: ModelId;
			name?: string;
			blue?: TargetRelationship<Blue, Relations.ForeignKey>
		}
		class Yellow extends Model<typeof Yellow, YellowDescriptors> {
			static modelName = "Yellow" as const;
			static fields = {
				id: attr(),
				name: attr(),
				blue: fk('Blue', 'yellows', { onDelete: 'CASCADE' })
			}

			public blue: TargetRelationship<Blue, Relations.ForeignKey>
		}

		type BlueDescriptors = {
			id: ModelId;
			name?: string;
			yellows?: SourceRelationship<typeof Yellow, Relations.ForeignKey>;
			greens?: SourceRelationship<typeof Green, Relations.ManyToMany>;
		}
		class Blue extends Model<typeof Blue, BlueDescriptors> {
			static modelName = "Blue" as const;
			static fields = {
				id: attr(),
				name: attr()
			}
		}

		type GreenDescriptors = {
			id: ModelId;
			name?: string;
			cascadeRed?: TargetRelationship<Red, Relations.OneToOne>;
			red?: TargetRelationship<Red, Relations.OneToOne>;
			blues?: TargetRelationship<Blue, Relations.ManyToMany>;
		}
		class Green extends Model<typeof Green, GreenDescriptors> {
			static modelName = "Green" as const;
			static fields = {
				id: attr(),
				name: attr(),
				cascadeRed: oneToOne('Red', 'cascadeGreen', { onDelete: 'CASCADE' }),
				red: oneToOne('Red', 'green'),
				blues: many('Blue', 'greens', { onDelete: 'CASCADE' })
			}

			public cascadeRed: TargetRelationship<Red, Relations.OneToOne>;
			public red: TargetRelationship<Red, Relations.OneToOne>;
			public blues: TargetRelationship<Blue, Relations.ManyToMany>;
		}

		type RedDescriptors = {
			id: ModelId;
			name?: string;
			cascadeTargetReds?: TargetRelationship<Red, Relations.ManyToMany>;
			cascadeSourceReds?: SourceRelationship<typeof Red, Relations.ManyToMany>;
			targetReds?: TargetRelationship<Red, Relations.ManyToMany>;
			sourceReds?: SourceRelationship<typeof Red, Relations.ManyToMany>;
			cascadeGreen?: SourceRelationship<typeof Green, Relations.OneToOne>;
			green?: SourceRelationship<typeof Green, Relations.OneToOne>;
		}
		class Red extends Model<typeof Red, RedDescriptors> {
			static modelName = "Red" as const;
			static fields = {
				id: attr(),
				name: attr(),
				targetReds: many('Red', 'sourceReds'),
				cascadeTargetReds: many('Red', 'cascadeSourceReds', { onDelete: 'CASCADE' })
			}

			public targetReds: TargetRelationship<Red, Relations.ManyToMany>;
			public cascadeTargetReds: TargetRelationship<Red, Relations.ManyToMany>;
		}
		
		return { Yellow, Blue, Green, Red };
	};
	type Schema = ValidateSchema<{
		Yellow: ReturnType<typeof getModelClasses>['Yellow'];
		Blue: ReturnType<typeof getModelClasses>['Blue'];
		Red: ReturnType<typeof getModelClasses>['Red'];
		Green: ReturnType<typeof getModelClasses>['Green'];
	}>;

	let session: SessionWithBoundModels<Schema>;

	beforeEach(() => {
		registry.clear();
		const { Yellow, Blue, Red, Green } = getModelClasses();
		const orm = new ORM<Schema>();
		orm.register(Yellow, Blue, Red, Green);
		session = orm.session();
	});

	describe('single instance', () => {
		it("removes referenced entities using 1-1 relation that have cascade delete option on", () => {
			const red = session.Red.create({ id: "1" });
			session.Green.create({ id: "4", cascadeRed: red });
	
			red.delete();
	
			expect(session.Red.count()).toBe(0);
			expect(session.Green.count()).toBe(0);
		});

		it("removes referenced entities using 1-N and N-M relation that have cascade delete option on", () => {
			const blue = session.Blue.create({ id: "1" });
			session.Yellow.create({ id: "2", blue });
			session.Green.create({ id: "3", blues: [blue] });
			session.Green.create({ id: "4" });
	
			blue.delete();
	
			expect(session.Yellow.count()).toBe(0);
			expect(session.Blue.count()).toBe(0);
			expect(session.Green.count()).toBe(1);
			expect(session.Green.withId('4')).not.toBe(null);
		});

		it("does not remove referenced entities if removing relationships parent", () => {
			const red = session.Red.create({ id: "1" });
			const blue1 = session.Blue.create({ id: "3" });
			const blue2 = session.Blue.create({ id: "4" });
			const green = session.Green.create({ id: "11", red, blues: [blue1, blue2] });
	
			green.delete();
	
			expect(session.Red.count()).toBe(1);
			expect(session.Blue.count()).toBe(2);
			expect(session.Green.count()).toBe(0);
		});

		it("removes referenced entities in self-referencing relationship if using cascade delete", () => {
			const red = session.Red.create({ id: "1" });
			session.Red.create({ id: "2", cascadeTargetReds: [red] });
	
			red.delete();
	
			expect(session.Red.count()).toBe(0);
		});
	});

	describe('query set', () => {
		it("removes referenced entities using 1-N and N-M relation that have cascade delete option on", () => {
			const blue1 = session.Blue.create({ id: "1" });
			const blue2 = session.Blue.create({ id: "11" });
			session.Yellow.create({ id: "2", blue: blue1 });
			session.Green.create({ id: "3", blues: [blue1, blue2] });
			session.Green.create({ id: "4" });
	
			session.Blue.all().delete();
	
			expect(session.Yellow.count()).toBe(0);
			expect(session.Blue.count()).toBe(0);
			expect(session.Green.count()).toBe(1);
			expect(session.Green.withId('4')).not.toBe(null);
		});

		it("removes referenced entities using 1-1 relation and others that have cascade delete option on", () => {
			const red1 = session.Red.create({ id: "1" });
			const red2 = session.Red.create({ id: "2" });
			session.Green.create({ id: "3", cascadeRed: red1 });
			session.Green.create({ id: "4", cascadeRed: red2 });
	
			session.Red.all().delete();
	
			expect(session.Red.count()).toBe(0);
			expect(session.Green.count()).toBe(0);
		});
	});
});
