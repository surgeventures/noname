import ORM from "../ORM";
import Model from "../Model";
import { fk, many, oneToOne, attr } from "../fields";
import { ModelId, TableRow } from "../types";
import Session from "../Session";

/**
 * These utils create a database schema for testing.
 * The schema is simple but covers most relational
 * cases: foreign keys, one-to-ones, many-to-many's,
 * named reverse relations.
 */

const AUTHORS_INITIAL = [
  {
    name: "Tommi Kaikkonen",
  },
  {
    name: "John Doe",
  },
  {
    name: "Stephen King",
  },
];

const COVERS_INITIAL = [
  {
    src: "cover.jpg",
  },
  {
    src: "cover.jpg",
  },
  {
    src: "cover.jpg",
  },
];

const GENRES_INITIAL = [
  {
    name: "Biography",
  },
  {
    name: "Autobiography",
  },
  {
    name: "Software Development",
  },
  {
    name: "Redux",
  },
];

const TAGS_INITIAL = [
  {
    name: "Technology",
  },
  {
    name: "Literary",
  },
  {
    name: "Natural",
  },
  {
    name: "Redux",
  },
];

const BOOKS_INITIAL = [
  {
    name: "Tommi Kaikkonen - an Autobiography",
    author: 0,
    cover: 0,
    genres: [0, 1],
    tags: ["Technology", "Literary"],
    releaseYear: 2050,
    publisher: 1,
  },
  {
    name: "Clean Code",
    author: 1,
    cover: 1,
    genres: [2],
    tags: ["Technology"],
    releaseYear: 2008,
    publisher: 0,
  },
  {
    name: "Getting Started with Redux",
    author: 2,
    cover: 2,
    genres: [2, 3],
    tags: ["Technology", "Redux"],
    releaseYear: 2015,
    publisher: 0,
  },
];

const PUBLISHERS_INITIAL = [
  {
    name: "Technical Publishing",
  },
  {
    name: "Autobiographies Inc",
  },
  {
    name: "Paramount Pictures",
  },
];

const MOVIES_INITIAL = [
  {
    name: "The Godfather",
    characters: ["Vito Corleone", "Tom Hagen", "Bonasera"],
    hasPremiered: true,
    rating: 9.2,
    meta: {},
    publisherId: 2,
  },
];

export class Book extends Model {
  static modelName = "Book";
  static fields = {
    id: attr(),
    name: attr(),
    releaseYear: attr(),
    author: fk("Author", "books"),
    cover: oneToOne("Cover"),
    genres: many("Genre", "books"),
    tags: many("Tag", "books"),
    publisher: fk("Publisher", "books"),
  };
}

export interface IQuerySet<T = Model> {
  toRefArray(): TableRow[];
  toModelArray(): T[];
  count(): number;
  exists(): boolean;
  at(index: number): T;
  first(): T | null;
  last(): T | null;
  all(): IQuerySet<T>;
  filter(lookupObj: object): IQuerySet<T>;
  exclude(lookupObj: object): IQuerySet<T>;
  orderBy(
    iteratees: string[],
    orders?: (boolean | "asc" | "desc")[]
  ): IQuerySet<T>;
  update(mergeObj: object): void;
  delete(): void;
  modelClass: T;
  _evaluate(): void;
  rows: TableRow[];
};

export interface IManyQuerySet<T = Model> extends IQuerySet<T> {
  add(...objs: (ModelId | T)[]): void;
  remove(...objs: (ModelId | T)[]): this;
  clear(): void;
};

export type BookProps = {
  id: ModelId;
  name: string;
  releaseYear: number;
  author: Author & AuthorProps;
  cover: Cover & CoverProps;
  genres: IManyQuerySet<Genre>;
  tags: IQuerySet<Tag>;
  publisher: Publisher & PublisherProps;
};

export class Author extends Model {
  static modelName = "Author";
  static fields = {
    id: attr(),
    name: attr(),
    publishers: many({
      to: "Publisher",
      through: "Book",
      relatedName: "authors",
    }),
  };
}

export type AuthorProps = {
  id: ModelId;
  name: string;
  publishers: IQuerySet<Publisher & PublisherProps>;
  books: IQuerySet<Author & AuthorProps>;
};

export class Cover extends Model {
  static modelName = "Cover";
  static fields = {
    id: attr(),
    src: attr(),
  };
}

export type CoverProps = {
  id: ModelId;
  src: string;
  book: Book & BookProps;
};

export class Genre extends Model {
  static modelName = "Genre";
  static fields = {
    id: attr(),
    name: attr(),
  };
}

export type GenreProps = {
  id: ModelId;
  name: string;
  books: IQuerySet<Book & BookProps>;
};

export class Tag extends Model {
  static modelName = "Tag";
  static options() {
    return {
      idAttribute: "name",
    };
  }
  static fields = {
    id: attr(),
    name: attr(),
    subTags: many("this", "parentTags"),
    // TODO: bidirectional many-to-many relations
    // synonymousTags: many('Tag', 'synonymousTags'),
  };
}

export type TagProps = {
  id: ModelId;
  name: string;
  subTags: IManyQuerySet<Tag & TagProps>;
  parentTags: IManyQuerySet<Tag & TagProps>;
  books: IQuerySet<Book & BookProps>;
};

export class Publisher extends Model {
  static modelName = "Publisher";
  static fields = {
    id: attr(),
    name: attr(),
  };
}

export type PublisherProps = {
  id: string;
  name: string;
  authors: IQuerySet<Author & AuthorProps>;
  movies: IManyQuerySet<Movie & MovieProps>;
};

export class Movie extends Model {
  static modelName = "Movie";
  static fields = {
    id: attr(),
    name: attr(),
    rating: attr(),
    hasPremiered: attr(),
    characters: attr(),
    meta: attr(),
    publisherId: fk({
      to: "Publisher",
      as: "publisher",
      relatedName: "movies",
    }),
  };
}

export type MovieProps = {
  id: ModelId;
  name: string;
  rating: number;
  hasPremiered: boolean;
  characters: string;
  meta: string;
  publisherId: Publisher;
  publisher: Publisher & PublisherProps;
};

export function createTestModels() {
  const MyBook = class extends Book {}
  const MyAuthor = class extends Author {}
  const MyCover = class extends Cover {}
  const MyGenre = class extends Genre {}
  const MyTag = class extends Tag {}
  const MyPublisher = class extends Publisher {}
  const MyMovie = class extends Movie {}

  return {
    Book: MyBook,
    Author: MyAuthor,
    Cover: MyCover,
    Genre: MyGenre,
    Tag: MyTag,
    Publisher: MyPublisher,
    Movie: MyMovie,
  };
}

export function createTestORM() {
  const {
    Book,
    Author,
    Cover,
    Genre,
    Tag,
    Publisher,
    Movie,
  } = createTestModels();

  const orm = new ORM();
  orm.register(Book, Author, Cover, Genre, Tag, Publisher, Movie);
  return orm;
}

export type ExtendedSession = Session & {
  Book: typeof Book & BookProps;
  Cover: typeof Cover & CoverProps;
  Genre: typeof Genre & GenreProps;
  Tag: typeof Tag & TagProps;
  Author: typeof Author & AuthorProps;
  BookGenres: typeof Model;
  BookTags: typeof Model;
  Movie: typeof Movie & MovieProps;
  Publisher: typeof Publisher & PublisherProps;
  TagSubTags: typeof Model;
};

export function createTestSession(): ExtendedSession {
  const orm = createTestORM();
  return orm.session(orm.getEmptyState()) as ExtendedSession;
}

export function createTestSessionWithData(customORM?: ORM) {
  const orm = customORM || createTestORM();
  const state = orm.getEmptyState();
  const {
    Author,
    Cover,
    Genre,
    Tag,
    Book,
    Publisher,
    Movie,
  } = (orm.mutableSession(state) as unknown) as ExtendedSession;

  AUTHORS_INITIAL.forEach((props) => Author.create(props));
  COVERS_INITIAL.forEach((props) => Cover.create(props));
  GENRES_INITIAL.forEach((props) => Genre.create(props));
  TAGS_INITIAL.forEach((props) => Tag.create(props));
  BOOKS_INITIAL.forEach((props) => Book.create(props));
  PUBLISHERS_INITIAL.forEach((props) => Publisher.create(props));
  MOVIES_INITIAL.forEach((props) => Movie.create(props));

  const normalSession = orm.session(state) as ExtendedSession;
  return { session: normalSession, orm, state };
}

export const isSubclass = (a: { prototype: object }, b: any) =>
  a.prototype instanceof b;

export function measureMsSince(): [number, number];
export function measureMsSince(start: [number, number]): number;
export function measureMsSince(
  startTime?: [number, number]
): number | [number, number] {
  if (!startTime) {
    return process.hrtime();
  }
  const endTime = process.hrtime(startTime);
  return Math.round(endTime[0] * 1000 + endTime[1] / 1000000);
}

export const nTimes = (n: number) => Array.from({ length: n });

export function measureMs(fn: (...args: any[]) => any) {
  const start = measureMsSince();
  fn(...arguments);
  return measureMsSince(start);
}

export const avg = (arr: number[], n: number) => {
  const sum = arr.reduce((cur, summand) => cur + summand);
  return sum / n;
};

export const round = (num: number, precision: number, base: number = 10) => {
  const precisionFactor = base ** precision;
  return Math.round(num * precisionFactor) / precisionFactor;
};
