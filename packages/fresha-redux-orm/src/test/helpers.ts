import ORM from "../ORM";
import Model, { AnyModel } from "../Model";
import { ModelId, Relations, SessionWithBoundModels, SourceRelationship, TargetRelationship } from "../types";
import { Attribute, ManyToMany, ForeignKey, OneToOne } from "../decorators";

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

export function createTestModels() {
  type BookDescriptors = {
    id?: ModelId;
    name?: string;
    releaseYear?: number;
    cover?: TargetRelationship<Cover, Relations.OneToOne>;
    genres?: TargetRelationship<Genre, Relations.ManyToMany>;
    tags?: TargetRelationship<Tag, Relations.ManyToMany>;
    publisher?: TargetRelationship<Publisher, Relations.ForeignKey>;
    author?: TargetRelationship<Author, Relations.ForeignKey>;
  }
  class Book extends Model<typeof Book, BookDescriptors> implements BookDescriptors {
    static modelName = "Book" as const;
  
    @Attribute()
    public id?: ModelId;
  
    @Attribute()
    public name?: string;
  
    @Attribute()
    public releaseYear?: number;
  
    @ForeignKey<Book>("Author", 'books')
    public author?: TargetRelationship<Author, Relations.ForeignKey>;
  
    @OneToOne<Book>("Cover")
    public cover?: TargetRelationship<Cover, Relations.OneToOne>;
  
    @ManyToMany<Book>("Genre", "books")
    public genres?: TargetRelationship<Genre, Relations.ManyToMany>;
  
    @ManyToMany<Book>("Tag", "books")
    public tags?: TargetRelationship<Tag, Relations.ManyToMany>;
  
    @ForeignKey<Book>("Publisher", "books")
    public publisher?: TargetRelationship<Publisher, Relations.ForeignKey>;
  }
  
  type AuthorDescriptors = {
    id?: ModelId;
    name?: string;
    publishers?: TargetRelationship<Publisher, Relations.ManyToMany>;
    books?: SourceRelationship<typeof Book, Relations.ForeignKey>;
  }
  class Author extends Model<typeof Author, AuthorDescriptors> implements AuthorDescriptors {
    static modelName = "Author" as const;
  
    @Attribute()
    public id?: ModelId;
  
    @Attribute()
    public name?: string;
  
    @ManyToMany<Author>({
      to: "Publisher",
      through: "Book",
      relatedName: "authors",
    } as any)
    public publishers?: TargetRelationship<Publisher, Relations.ManyToMany>;
  
    public books?: SourceRelationship<typeof Book, Relations.ForeignKey>;
  }
  
  
  type CoverDescriptors = {
    id?: ModelId;
    src: string;
    book?: SourceRelationship<typeof Book, Relations.OneToOne>;
  };
  class Cover extends Model<typeof Cover, CoverDescriptors> implements CoverDescriptors {
    static modelName = "Cover" as const;
    
    @Attribute()
    public id?: ModelId;
    
    @Attribute()
    public src: string;
  
    public book?: SourceRelationship<typeof Book, Relations.OneToOne>;
  }
  
  type GenreProps = {
    id?: ModelId;
    name: string;
    books?: SourceRelationship<typeof Book, Relations.ManyToMany>;
  };
  
  class Genre extends Model<typeof Genre, GenreProps> implements GenreProps {
    static modelName = "Genre" as const;
  
    @Attribute()
    public id?: ModelId;
    
    @Attribute()
    public name: string;
  
    public books?: SourceRelationship<typeof Book, Relations.ManyToMany>;
  }
  
  type TagDescriptors = {
    id?: ModelId;
    name: string;
    subTags?: TargetRelationship<Tag, Relations.ManyToMany>;
    parentTags?: SourceRelationship<typeof Tag, Relations.ManyToMany>;
    books?: SourceRelationship<typeof Book, Relations.ManyToMany>;
  };
  class Tag extends Model<typeof Tag, TagDescriptors> implements TagDescriptors {
    static modelName = "Tag" as const;
    static options() {
      return {
        idAttribute: "name",
      };
    }
  
    @Attribute()
    public id: string;
  
    @Attribute()
    public name: string;

    //@ts-ignore
    @ManyToMany("this", "parentTags")
    public subTags?: TargetRelationship<Tag, Relations.ManyToMany>;
  
    public parentTags?: SourceRelationship<typeof Tag, Relations.ManyToMany>;
    public books?: SourceRelationship<typeof Book, Relations.ManyToMany>;
  }
  
  type PublisherDescriptors = {
    id?: ModelId;
    name?: string;
    authors?: SourceRelationship<typeof Author, Relations.ManyToMany>;
    movies?: SourceRelationship<typeof Movie, Relations.ForeignKey>;
  };
  
  class Publisher extends Model<typeof Publisher, PublisherDescriptors> implements PublisherDescriptors {
    static modelName = "Publisher" as const;
  
    @Attribute()
    public id?: string;
  
    @Attribute()
    public name?: string;
  
    public authors?: SourceRelationship<typeof Author, Relations.ManyToMany>;
    public movies?: SourceRelationship<typeof Movie, Relations.ForeignKey>;
  }
  
  type MovieDescriptors = {
    id?: ModelId;
    name?: string;
    rating?: number;
    hasPremiered?: boolean;
    characters?: string[];
    meta?: {};
    publisherId?: TargetRelationship<Publisher, Relations.ForeignKey>;
    publisher?: TargetRelationship<Publisher, Relations.ForeignKey>;
  };
  
  class Movie extends Model<typeof Movie, MovieDescriptors> implements MovieDescriptors {
    static modelName = "Movie" as const;
  
    @Attribute()
    public id?: ModelId;
  
    @Attribute()
    public name?: string;
  
    @Attribute()
    public rating?: number;
  
    @Attribute()
    public hasPremiered?: boolean;
  
    @Attribute()
    public characters?: string[];
  
    @Attribute()
    public meta?: {};
  
    
    @ForeignKey<Movie>({
      to: "Publisher",
      as: "publisher",
      relatedName: "movies",
    } as any)
    public publisherId?: TargetRelationship<Publisher, Relations.ForeignKey>;
  
    public publisher?: TargetRelationship<Publisher, Relations.ForeignKey>;
  }

  return {
    Book,
    Author,
    Cover,
    Genre,
    Tag,
    Publisher,
    Movie,
  };
}

export type Schema = {
  BookGenres: typeof AnyModel;
  BookTags: typeof AnyModel;
  TagSubTags: ReturnType<typeof createTestModels>['Tag'];
} & ReturnType<typeof createTestModels>;

export type ExtendedSession = SessionWithBoundModels<Schema>;

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

  const normalSession = orm.session(state);
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
