import ORM from "../ORM";
import Model from "../Model";
import { fk, many, oneToOne, attr } from "../fields";
import { ModelId, Relations, SessionBoundModel, SessionLike, TargetRelationship } from "../types";
import { QuerySet } from "..";

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

export type BookDescriptors = {
  id?: ModelId;
  name?: string;
  releaseYear?: number;
  author?: TargetRelationship<Author, Relations.ForeignKey>;
  cover?: TargetRelationship<Cover, Relations.OneToOne>;
  genres?: TargetRelationship<Genre, Relations.ManyToMany>;
  // @ts-ignore
  tags?: TargetRelationship<Tag, Relations.ManyToMany>;
  publisher?: TargetRelationship<Publisher, Relations.ForeignKey>;
}
export class Book extends Model<typeof Book, BookDescriptors> {
  static modelName = "Book" as const;
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

export type AuthorDescriptors = {
  id?: ModelId;
  name: string;
  publishers?: TargetRelationship<Publisher, Relations.ManyToMany>;
  books?: unknown;
}
export class Author extends Model<typeof Author, AuthorDescriptors> {
  static modelName = "Author" as const;
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


export type CoverDescriptors = {
  id?: ModelId;
  src: string;
  book?: unknown;
};
export class Cover extends Model<typeof Cover, CoverDescriptors> {
  static modelName = "Cover" as const;
  static fields = {
    id: attr(),
    src: attr(),
  };
}

export type GenreProps = {
  id?: ModelId;
  name: string;
  books?: unknown;
};

export class Genre extends Model<typeof Genre, GenreProps> {
  static modelName = "Genre" as const;
  static fields = {
    id: attr(),
    name: attr(),
  };
}

export type TagDescriptors = {
  id?: ModelId;
  name: string;
  subTags?: unknown; // Should be TargetRelationship<Tag, Relations.ManyToMany>
  parentTags?: unknown; // Verify the structure - should be TargetRelationship<Tag, Relations.ManyToMany>
  books?: unknown;
};
export class Tag extends Model<typeof Tag, TagDescriptors> {
  static modelName = "Tag" as const;
  static options() {
    return {
      idAttribute: "name",
    };
  }
  static fields = {
    id: attr(),
    name: attr(),
    subTags: many("this", "parentTags"),
  };
}

export type PublisherDescriptors = {
  id?: ModelId;
  name?: string;
  authors?: unknown;
  movies?: unknown;
};

export class Publisher extends Model<typeof Publisher, PublisherDescriptors> {
  static modelName = "Publisher" as const;
  static fields = {
    id: attr(),
    name: attr(),
  };
}

export type MovieDescriptors = {
  id?: ModelId;
  name?: string;
  rating?: number;
  hasPremiered?: boolean;
  characters?: string[];
  meta?: {};
  publisherId?: ModelId;
  publisher?: TargetRelationship<Publisher, Relations.ForeignKey>;
};

export class Movie extends Model<typeof Movie, MovieDescriptors> {
  static modelName = "Movie" as const;
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

type Test = SessionBoundModel<Movie>;

const obj = {} as Test;
obj.publisher

export function createTestModels() {
  const MyBook = class extends Book {};
  const MyAuthor = class extends Author {};
  const MyCover = class extends Cover {};
  const MyGenre = class extends Genre {};
  const MyTag = class extends Tag {};
  const MyPublisher = class extends Publisher {};
  const MyMovie = class extends Movie {};

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

export type Schema = {
  Book: typeof Book;
  Cover: typeof Cover;
  Genre: typeof Genre;
  Tag: typeof Tag;
  Author: typeof Author;
  Movie: typeof Movie; 
  Publisher: typeof Publisher;
  
  BookGenres: typeof Model; // Verify
  BookTags: typeof Model; // Verify
  TagSubTags: typeof Tag; // Verify
}

export type ExtendedSession = SessionLike<Schema>;

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

  const orm = new ORM<Schema>();
  orm.register(Book, Author, Cover, Genre, Tag, Publisher, Movie);
  return orm;
}


export function createTestSession(): ExtendedSession {
  const orm = createTestORM();
  return orm.session(orm.getEmptyState());
}

export function createTestSessionWithData(customORM?: ORM<Schema>) {
  const orm = customORM || createTestORM();
  const state = orm.getEmptyState();
  const { Author, Cover, Genre, Tag, Book, Publisher, Movie } = orm.mutableSession(state);

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
