import {
  ORM,
  createReducer,
  createSelector,
  Model,
} from "../..";
import { ModelId, OrmState, ReduxAction, Ref, SessionWithBoundModels, TableState, ValidateSchema } from "../../types";
import {
  Schema,
  createTestModels,
} from "../helpers";
import { ModelDescriptorsRegistry } from "../../modelDescriptorsRegistry";

describe("Redux integration", () => {
  let orm: ORM<Schema>;
  let Book: Schema['Book'];
  let Cover: Schema['Cover'];
  let Genre: Schema['Genre'];
  let Tag: Schema['Tag'];
  let Author: Schema['Author'];
  let Publisher: Schema['Publisher'];
  let Movie: Schema['Movie'];
  let emptyState: OrmState<Schema>;
  let nextState: OrmState<Schema>;
  let ormReducer: <MClassType extends Schema[keyof Schema]>(
    state: OrmState<Schema> | undefined,
    action: ReduxAction<Ref<InstanceType<MClassType>>>
  ) => OrmState<Schema>;

  const CREATE_MOVIE = "CREATE_MOVIE";
  const CREATE_PUBLISHER = "CREATE_PUBLISHER";

  const createModelReducers = () => {
    Author.reducer = jest.fn();
    Book.reducer = jest.fn();
    Cover.reducer = jest.fn();
    Genre.reducer = jest.fn();
    Tag.reducer = jest.fn();
    Movie.reducer = jest.fn(
      ((action: ReduxAction<Ref<InstanceType<Schema[keyof Schema]>>>, Model: Schema['Movie']) => {
        switch (action.type) {
          case CREATE_MOVIE:
            Model.create(action.payload || {});
            break;
          default:
            break;
        }
      }) as any
    );
    Publisher.reducer = jest.fn(
      ((action: ReduxAction<Ref<InstanceType<Schema['Publisher']>>>, Model: Schema['Publisher']) => {
        switch (action.type) {
          case CREATE_PUBLISHER:
            Model.create(action.payload || {});
            break;
          default:
            break;
        }
      }) as any
    );
  };

  beforeEach(() => {
    const registry = ModelDescriptorsRegistry.getInstance();
    registry.clear();
    ({
      Book,
      Cover,
      Genre,
      Tag,
      Author,
      Movie,
      Publisher,
    } = createTestModels());
    orm = new ORM<Schema>();
    orm.register(Book, Cover, Genre, Tag, Author, Movie, Publisher);
    ormReducer = createReducer(orm);
    createModelReducers();
  });

  it("runs reducers if explicitly specified", () => {
    emptyState = orm.getEmptyState();
    const mockAction = { type: "mock", payload: null };
    nextState = ormReducer(emptyState, mockAction);

    expect(nextState).toBeDefined();

    expect(Author.reducer).toHaveBeenCalledTimes(1);
    expect(Book.reducer).toHaveBeenCalledTimes(1);
    expect(Cover.reducer).toHaveBeenCalledTimes(1);
    expect(Genre.reducer).toHaveBeenCalledTimes(1);
    expect(Tag.reducer).toHaveBeenCalledTimes(1);
    expect(Publisher.reducer).toHaveBeenCalledTimes(1);
    expect(Movie.reducer).toHaveBeenCalledTimes(1);
  });

  it("correctly returns a different state when calling a reducer", () => {
    emptyState = orm.getEmptyState();
    nextState = ormReducer(emptyState, {
      type: CREATE_MOVIE,
      payload: {
        id: 0,
        name: "Let there be a movie",
      },
    });
    expect(nextState.Movie.itemsById).toEqual<TableState<typeof Movie>['itemsById']>({
      0: {
        id: 0,
        name: "Let there be a movie",
      },
    });
  });

  it("calling reducer with undefined state doesn't throw", () => {
    ormReducer = createReducer(orm);
    ormReducer(undefined, { type: "______init", payload: null });
  });

  describe("selectors memoize results as intended", () => {
    beforeEach(() => {
      emptyState = orm.getEmptyState();
    });

    it("basic selector", () => {
      const memoized = jest.fn();
      const selector = createSelector(orm, memoized);
      expect(typeof selector).toBe("function");

      selector(emptyState);
      expect(memoized).toHaveBeenCalledTimes(1);
      selector(emptyState);
      expect(memoized).toHaveBeenCalledTimes(1);

      // same empty state, but different reference
      selector(orm.getEmptyState());
      expect(memoized).toHaveBeenCalledTimes(1);
    });

    it("arbitrary filters", () => {
      const memoized = jest.fn((selectorSession: SessionWithBoundModels<Schema>) =>
        selectorSession.Movie.filter(
          movie => movie.name === "Getting started with filters"
        ).toRefArray()
      );
      const selector = createSelector(orm, memoized);

      selector(emptyState);
      expect(memoized).toHaveBeenCalledTimes(1);
      selector(emptyState);
      expect(memoized).toHaveBeenCalledTimes(1);

      nextState = ormReducer(emptyState, {
        type: CREATE_MOVIE,
        payload: {
          name: "Getting started with filters",
        },
      });

      selector(nextState);
      expect(memoized).toHaveBeenCalledTimes(2);
    });

    it("id lookups", () => {
      const memoized = jest.fn((selectorSession: SessionWithBoundModels<Schema>) => {
        return selectorSession.Movie.withId(0)
      });
      const selector = createSelector(orm, memoized);
      expect(typeof selector).toBe("function");

      selector(emptyState);
      expect(memoized).toHaveBeenCalledTimes(1);
      selector(emptyState);
      expect(memoized).toHaveBeenCalledTimes(1);

      nextState = ormReducer(emptyState, {
        type: CREATE_MOVIE,
        payload: {
          name: "Getting started with id lookups",
        },
      });

      selector(nextState);
      expect(memoized).toHaveBeenCalledTimes(2);
    });

    it("empty QuerySets", () => {
      const memoized = jest.fn((selectorSession: SessionWithBoundModels<Schema>) =>
        selectorSession.Movie.all().toModelArray()
      );
      const selector = createSelector(orm, memoized);
      expect(typeof selector).toBe("function");

      selector(emptyState);
      expect(memoized).toHaveBeenCalledTimes(1);
      selector(emptyState);
      expect(memoized).toHaveBeenCalledTimes(1);

      nextState = ormReducer(emptyState, {
        type: CREATE_MOVIE,
        payload: {
          name: "Getting started with empty query sets",
        },
      });

      selector(nextState);
      expect(memoized).toHaveBeenCalledTimes(2);
    });

    it("Model updates", () => {
      const session = orm.session();
      const memoized = jest.fn((selectorSession: SessionWithBoundModels<Schema>) =>
        selectorSession.Movie.withId(0)
      );
      const selector = createSelector(orm, memoized);

      const movie = session.Movie.create({
        name: "Name after creation",
      });

      selector(session.state);
      expect(memoized).toHaveBeenCalledTimes(1);
      selector(session.state);
      expect(memoized).toHaveBeenCalledTimes(1);

      movie.name = "Updated name";

      selector(session.state);
      expect(memoized).toHaveBeenCalledTimes(2);
    });

    it("Model deletions", () => {
      const session = orm.session();
      const memoized = jest.fn((selectorSession: SessionWithBoundModels<Schema>) =>
        selectorSession.Movie.withId(0)
      );
      const selector = createSelector(orm, memoized);

      const movie = session.Movie.create({
        name: "Name after creation",
      });

      selector(session.state);
      expect(memoized).toHaveBeenCalledTimes(1);
      selector(session.state);
      expect(memoized).toHaveBeenCalledTimes(1);

      movie.delete();

      selector(session.state);
      expect(memoized).toHaveBeenCalledTimes(2);
    });

    it("foreign key descriptors", () => {
      const memoized = jest.fn((selectorSession: SessionWithBoundModels<Schema>) =>
        selectorSession.Movie.all()
          .toModelArray()
          .reduce(
            (map, movie) => ({
              ...map,
              [movie.id!]: movie.publisher ? movie.publisher.ref : null,
            }),
            {} as Record<ModelId, Ref<InstanceType<Schema['Publisher']>> | null>
          )
      );
      const selector = createSelector(orm, memoized);
      expect(typeof selector).toBe("function");

      expect(selector(emptyState)).toEqual({});
      expect(memoized).toHaveBeenCalledTimes(1);

      nextState = ormReducer<Schema['Movie']>(emptyState, {
        type: CREATE_MOVIE,
        payload: {
          id: 532,
          name: "Getting started with FK descriptors",
          publisherId: 123,
        },
      });

      expect(selector(nextState)).toEqual({
        532: null,
      });
      expect(memoized).toHaveBeenCalledTimes(2);

      // random other publisher that should be of no interest
      nextState = ormReducer<Schema['Publisher']>(nextState, {
        type: CREATE_PUBLISHER,
        payload: {
          id: 999,
          name: "random uninteresting publisher",
        },
      });

      expect(selector(nextState)).toEqual({
        532: null,
      });
      expect(memoized).toHaveBeenCalledTimes(2);

      nextState = ormReducer<Schema['Publisher']>(nextState, {
        type: CREATE_PUBLISHER,
        payload: {
          id: 123,
          name: "publisher referenced by movie FK",
        },
      });

      expect(selector(nextState)).toEqual({
        532: {
          id: 123,
          name: "publisher referenced by movie FK",
        },
      });
      expect(memoized).toHaveBeenCalledTimes(3);

      const session = orm.session(nextState);
      expect(
        session.Publisher.withId(123)!.movies!.count()
      ).toBe(1);
    });

    it("custom Model table options", () => {
      type CustomizedModelDescriptors = {
        name: string;
      }
      class CustomizedModel extends Model<typeof CustomizedModel, CustomizedModelDescriptors> {
        static modelName = "CustomizedModel" as const;
      }

      type Schema = ValidateSchema<{ CustomizedModel: typeof CustomizedModel }>;

      const _orm = new ORM<Schema>();
      _orm.register(CustomizedModel);
      const session = _orm.session();

      const memoized = jest.fn((selectorSession: SessionWithBoundModels<Schema>) =>
        selectorSession.CustomizedModel.count()
      );
      const selector = createSelector(_orm, memoized);

      selector(session.state);
      expect(memoized).toHaveBeenCalledTimes(1);
      session.CustomizedModel.create({
        name: "Name after creation",
      });
      selector(session.state);
      expect(memoized).toHaveBeenCalledTimes(2);
    });
  });
});
