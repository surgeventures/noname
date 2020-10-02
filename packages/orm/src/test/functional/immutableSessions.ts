import deepFreeze from "deep-freeze";
import { Model, QuerySet, ORM, attr, Session } from "../..";
import { OrmState, TableRow } from "../../types";
import {
  Author,
  AuthorProps,
  BookProps,
  createTestSessionWithData,
  ExtendedSession,
  MovieProps,
  Publisher as PublisherType,
  PublisherProps,
  GenreProps,
  TagProps, Book, Movie
} from "../helpers";

type WithSetter = {
  author: Author | number | null;
};

describe("Immutable session", () => {
  let session: ExtendedSession;
  let state: OrmState;

  beforeEach(() => {
    // Deep freeze state. This will raise an error if we
    // mutate the state.

    const result = createTestSessionWithData();
    session = (result.session as unknown) as ExtendedSession;
    state = result.state;

    deepFreeze(state);
  });

  it("Initial data bootstrapping results in a correct state", () => {
    expect(state).toEqual(
      expect.objectContaining({
        Book: expect.anything(),
        Cover: expect.anything(),
        Genre: expect.anything(),
        Tag: expect.anything(),
        Author: expect.anything(),
        BookGenres: expect.anything(),
        BookTags: expect.anything(),
        Movie: expect.anything(),
      })
    );

    expect(state.Book.items).toHaveLength(3);
    expect(Object.keys(state.Book.itemsById)).toHaveLength(3);

    expect(state.Cover.items).toHaveLength(3);
    expect(Object.keys(state.Cover.itemsById)).toHaveLength(3);

    expect(state.Genre.items).toHaveLength(4);
    expect(Object.keys(state.Genre.itemsById)).toHaveLength(4);

    expect(state.BookGenres.items).toHaveLength(5);
    expect(Object.keys(state.BookGenres.itemsById)).toHaveLength(5);

    expect(state.Tag.items).toHaveLength(4);
    expect(Object.keys(state.Tag.itemsById)).toHaveLength(4);

    expect(state.BookTags.items).toHaveLength(5);
    expect(Object.keys(state.BookTags.itemsById)).toHaveLength(5);

    expect(state.Author.items).toHaveLength(3);
    expect(Object.keys(state.Author.itemsById)).toHaveLength(3);

    expect(state.Publisher.items).toHaveLength(3);
    expect(Object.keys(state.Publisher.itemsById)).toHaveLength(3);

    expect(state.Movie.items).toHaveLength(1);
    expect(Object.keys(state.Movie.itemsById)).toHaveLength(1);
  });

  it("Models correctly indicate if id exists", () => {
    type SessionWithBook = {
      Book: typeof Model;
    };

    const { Book } = (session as unknown) as SessionWithBook;
    expect(Book.idExists(0)).toBe(true);
    expect(Book.idExists(92384)).toBe(false);
    expect(Book.idExists()).toBe(false);
  });

  it("Models correctly create new instances", () => {
    const { Book } = session;
    const book = Book.create({
      name: "New Book",
      author: 0,
      releaseYear: 2015,
      publisher: 0,
    });
    expect(session.Book.count()).toBe(4);
    expect(session.Book.last()!.ref).toBe(book.ref);
  });

  it("Model.getId works", () => {
    const { Book } = session;
    expect(Book.withId(0)!.getId()).toBe(0);
    expect(Book.withId(1)!.getId()).toBe(1);
  });

  it("Model.create throws if passing duplicate ids to many-to-many field", () => {
    const { Book } = session;

    const newProps = {
      name: "New Book",
      author: 0,
      releaseYear: 2015,
      genres: [0, 0],
      publisher: 0,
    };

    expect(() => Book.create(newProps)).toThrow("Book.genres");
  });

  it("Models are correctly deleted", () => {
    const { Book } = session;
    expect(Book.count()).toBe(3);
    Book.withId(0)!.delete();
    expect(session.Book.count()).toBe(2);
    expect(session.Book.idExists(0)).toBe(false);
  });

  it("Models with backwards virtual (1-to-n) key fields are correctly deleted", () => {
    const { Author } = session;
    expect(Author.count()).toBe(3);
    Author.withId(0)!.delete();
    expect(session.Author.count()).toBe(2);
    expect(session.Author.idExists(0)).toBe(false);
  });

  it("Models with backwards virtual 1-to-1 key fields are correctly deleted", () => {
    const { Cover } = session;
    expect(Cover.count()).toBe(3);
    Cover.withId(0)!.delete();
    expect(session.Cover.count()).toBe(2);
    expect(session.Cover.idExists(0)).toBe(false);
  });

  it("Models correctly update when setting properties", () => {
    const { Book } = session;
    const book = Book.first();
    const newName = "New Name";
    ((book as unknown) as BookProps).name = newName;
    expect(((session.Book.first() as unknown) as BookProps).name).toBe(newName);
  });

  it("Model.toString works", () => {
    const { Book } = session;
    const book = Book.first() as Model;
    expect(book.toString()).toBe(
      "Book: {id: 0, name: Tommi Kaikkonen - an Autobiography, " +
        "releaseYear: 2050, author: 0, cover: 0, genres: [0, 1], tags: [Technology, Literary], publisher: 1}"
    );
  });

  it("withId returns null if model instance not found", () => {
    const { Book } = session;
    expect(Book.withId(9043290)).toBe(null);
  });

  it("get returns null if model instance not found", () => {
    const { Book } = session;
    expect(
      Book.get({
        name: "does not exist",
      })
    ).toBe(null);
  });

  it("get throws if multiple model instances are found", () => {
    const { Book } = session;
    Book.create({ name: "Clean Code" });
    expect(() =>
      Book.get({
        name: "Clean Code",
      })
    ).toThrow("Expected to find a single row in `Book.get`. Found 2.");
  });

  it("updating arbitrary fields created during model construction works", () => {
    const { Book } = session;
    const book = new Book({ someNumber: 123 });
    expect((book as { [k: string]: any }).someNumber).toBe(123);
    (book as { [k: string]: any }).someNumber = 321;
    expect((book as { [k: string]: any }).someNumber).toBe(321);
  });

  it("Models correctly create a new instance via upsert when not passing an ID", () => {
    const { Book } = session;
    const book = Book.upsert({
      name: "New Book",
      author: 0,
      releaseYear: 2015,
      publisher: 0,
    });
    expect(session.Book.count()).toBe(4);
    expect(session.Book.last()!.ref).toBe(book.ref);
    expect(book).toBeInstanceOf(Book);
  });

  it("Models correctly create a new instance via upsert when passing a non-existant ID", () => {
    const { Book } = session;
    const book = Book.upsert({
      [Book.idAttribute]: 123123132,
      name: "New Book",
      author: 0,
      releaseYear: 2015,
      publisher: 0,
    });
    expect(session.Book.count()).toBe(4);
    expect(session.Book.last()!.ref).toBe(book.ref);
    expect(book).toBeInstanceOf(Book);
  });

  it("Models correctly update existing instance via upsert", () => {
    const { Book } = session;
    const book = Book.create({
      name: "New Book",
      author: 0,
      releaseYear: 2015,
      publisher: 0,
    });
    expect(session.Book.count()).toBe(4);
    expect(session.Book.last()!.ref).toBe(book.ref);
    expect(((session.Book.last() as unknown) as BookProps).releaseYear).toBe(
      2015
    );

    const { ref: storedRef } = book;
    const nextBook = Book.upsert({
      [Book.idAttribute]: book.getId(),
      releaseYear: 2016,
    });

    expect(session.Book.count()).toBe(4);
    expect(session.Book.last()!.ref).toBe(nextBook.ref);
    expect(((session.Book.last() as unknown) as BookProps).releaseYear).toBe(
      2016
    );
    expect(session.Book.last()!.ref).not.toBe(storedRef);
    expect(book.ref).toBe(nextBook.ref);
    expect(nextBook).toBeInstanceOf(Book);
  });

  it("Model updates preserve instance reference if fields are referentially equal", () => {
    const { Movie } = session;

    const movie = Movie.first() as Model;
    const { name, characters, meta } = (movie as unknown) as MovieProps;
    const oldRef = movie.ref;

    movie.update({ name });
    expect(oldRef).toBe(movie.ref);

    movie.update({ meta });
    expect(oldRef).toBe(movie.ref);

    movie.update({ characters });
    expect(oldRef).toBe(movie.ref);
  });

  it("Model updates change instance reference if string field changes", () => {
    const { Movie } = session;

    const movie = Movie.first() as Model;
    const oldRef = movie.ref;

    movie.update({ name: "New name" });
    expect(oldRef).not.toBe(movie.ref);
  });

  it("Model updates change instance reference if object field changes reference", () => {
    const { Movie } = session;

    const movie = Movie.first() as Model;
    const oldRef = movie.ref;

    movie.update({ meta: {} });
    expect(oldRef).not.toBe(movie.ref);
  });

  it("Model updates only change instance reference if equals returns false", () => {
    const { Movie } = session;

    const movie = Movie.first() as Model;
    const oldRef = movie.ref;

    movie.equals = (_otherModel) => true;
    movie.update({
      name: "New name",
      rating: 10,
      hasPremiered: false,
      characters: [],
      meta: {},
    });
    expect(oldRef).toBe(movie.ref);

    const movie2 = Movie.create({
      characters: ["Joker"],
    });
    const oldRef2 = movie2.ref;
    movie2.equals = function characterAmountsEqual(otherModel) {
      return (
        this._fields.characters.length === otherModel._fields.characters.length
      );
    };

    // length of characters array is equal, should not cause change of reference
    movie2.update({ characters: ["Joker"] });
    expect(oldRef2).toBe(movie2.ref);

    // length of characters array has changed, should cause change of reference
    movie2.update({ characters: ["Joker", "Mickey Mouse"] });
    expect(oldRef2).not.toBe(movie2.ref);
    const newRef2 = movie2.ref;

    // length of characters array has not changed, should cause change of reference
    movie2.update({ characters: ["Batman", "Catwoman"] });
    expect(newRef2).toBe(movie2.ref);
  });

  it("Model updates preserve relations if only other fields are changed", () => {
    const { Book } = session;

    const genres = [1, 2];
    const book = Book.create({
      name: "Book name",
      genres,
    }) as unknown as (typeof Book & BookProps);
    expect(
      book.genres
        .all()
        .toRefArray()
        .map((genre) => genre.id)
    ).toEqual([1, 2]);
    // update with same string, expect relations to be preserved
    book.update({ name: "Updated Book name" });
    expect(
      book.genres
        .all()
        .toRefArray()
        .map((genre) => genre.id)
    ).toEqual([1, 2]);
  });

  it("Model updates change relations if only relations are updated", () => {
    const { Book, Genre } = session;

    const genres = [1, 2];
    const book = Book.create({
      name: "New Book",
      genres,
    }) as unknown as (typeof Book & BookProps);
    expect(
      book.genres
        .all()
        .toRefArray()
        .map((genre) => genre.id)
    ).toEqual([1, 2]);

    // mutate array by appending element without changing reference
    genres.push(3);
    // update book with field containing the same reference
    book.update({ genres });
    /**
     * update should have seen equality of fields
     * but still caused an update of the genres relation
     */
    expect(
      book.genres
        .all()
        .toRefArray()
        .map((genre: TableRow) => genre.id)
    ).toEqual([1, 2, 3]);
    /* the backward relation must have been updated as well */
    expect(
      (Genre.withId(3)! as unknown as (typeof Genre & GenreProps))
        .books.all()
        .toRefArray()
        .map((_book: TableRow) => _book.id)
        .includes(book.id)
    ).toBeTruthy();
  });

  it("many-to-many relationship descriptors work", () => {
    const { Book, Genre, Tag } = session;

    // Forward (from many-to-many field declaration)
    const book = (Book.first()! as unknown) as typeof Book & BookProps;
    const relatedGenres = book.genres;
    expect(relatedGenres).toBeInstanceOf(QuerySet);
    expect(relatedGenres.modelClass).toBe(Genre);
    expect(relatedGenres.count()).toBe(2);

    // Backward
    const genre = (Genre.first()! as unknown) as typeof Genre & GenreProps;
    const relatedBooks = genre.books;
    expect(relatedBooks).toBeInstanceOf(QuerySet);
    expect(relatedBooks.modelClass).toBe(Book);

    // Forward (from many-to-many field declaration with idAttribute is name)
    const relatedTags = book.tags;
    expect(relatedTags).toBeInstanceOf(QuerySet);
    expect(relatedTags.modelClass).toBe(Tag);
    expect(relatedTags.count()).toBe(2);

    // Backward
    const tag = (Tag.first()! as unknown) as typeof Tag & TagProps;
    const tagRelatedBooks = tag.books;
    expect(tagRelatedBooks).toBeInstanceOf(QuerySet);
    expect(tagRelatedBooks.modelClass).toBe(Book);
  });

  it("many-to-many relationship descriptors work with a custom through model", () => {
    const { Author, Publisher } = session;

    // Forward (from many-to-many field declaration)
    const author = Author.get({ name: "Tommi Kaikkonen" })!;
    const relatedPublishers = ((author as unknown) as AuthorProps).publishers;
    expect(relatedPublishers).toBeInstanceOf(QuerySet);
    expect(relatedPublishers.modelClass).toBe(Publisher);
    expect(relatedPublishers.count()).toBe(1);

    // Backward
    const publisher = Publisher.get({ name: "Technical Publishing" })!;
    const relatedAuthors = ((publisher as unknown) as PublisherProps).authors;
    expect(relatedAuthors).toBeInstanceOf(QuerySet);
    expect(relatedAuthors.modelClass).toBe(Author);
    expect(relatedAuthors.count()).toBe(2);
  });

  it("adding related many-to-many entities works", () => {
    const { Book, Genre } = session;
    const book = (Book.withId(0)! as unknown) as typeof Book & BookProps;
    expect(book.genres.count()).toBe(2);
    book.genres.add(Genre.withId(2)!);
    expect(book.genres.count()).toBe(3);
  });

  it("trying to add existing related many-to-many entities throws", () => {
    const { Book } = session;
    const book = Book.withId(0)! as unknown as (typeof Book & BookProps);

    const existingId = 1;
    expect(() => book.genres.add(existingId)).toThrow(existingId.toString());
  });

  // it("trying to set many-to-many fields throws", () => {
  //   const { Book } = session;
  //   const book = Book.withId(0)! as unknown as (typeof Book & BookProps);;
  //   expect(() => {
  //     book.genres = "whatever";
  //   }).toThrow(
  //     "Tried setting a M2M field. Please use the related QuerySet methods add, remove and clear."
  //   );
  // });

  it("updating related many-to-many entities through ids works", () => {
    const { Book, Genre, Author } = session;
    const tommi = Author.get({ name: "Tommi Kaikkonen" })! as unknown as (typeof Author & AuthorProps);
    const book = tommi.books.first()! as unknown as (typeof Book & BookProps);
    expect(book.genres.toRefArray().map((row: TableRow) => row.id)).toEqual([
      0,
      1,
    ]);

    const deleteGenre = Genre.withId(0) as unknown as (typeof Genre & GenreProps);;

    book.update({ genres: [1, 2] });
    expect(book.genres.toRefArray().map((row: TableRow) => row.id)).toEqual([
      1,
      2,
    ]);

    expect(deleteGenre!.books.filter({ id: book.id }).exists()).toBe(false);
  });

  it("updating related many-to-many with not existing entities works", () => {
    const { Book } = session;
    const book = Book.first()! as unknown as (typeof Book & BookProps);

    book.update({ genres: [0, 99] });

    expect(
      session.BookGenres.filter({ fromBookId: book.id })
        .toRefArray()
        .map((row: TableRow) => row.toGenreId)
    ).toEqual([0, 99]);
    expect(book.genres.toRefArray().map((row: TableRow) => row.id)).toEqual([
      0,
    ]);

    book!.update({ genres: [1, 98] });

    expect(
      session.BookGenres.filter({ fromBookId: book!.id })
        .toRefArray()
        .map((row: TableRow) => row.toGenreId)
    ).toEqual([1, 98]);
    expect(book.genres.toRefArray().map((row: TableRow) => row.id)).toEqual([
      1,
    ]);
  });

  it("updating non-existing many-to-many entities works", () => {
    const { Genre, Author } = session;
    const tommi = Author.get({ name: "Tommi Kaikkonen" })! as unknown as (typeof Author & AuthorProps);
    const book = tommi.books.first() as unknown as (typeof Book & BookProps);
    expect(book.genres.toRefArray().map((row: TableRow) => row.id)).toEqual([
      0,
      1,
    ]);

    const deleteGenre = Genre.withId(0)! as unknown as (typeof Genre & GenreProps);
    const keepGenre = Genre.withId(1)! as unknown as (typeof Genre & GenreProps);
    const addGenre = Genre.withId(2)! as unknown as (typeof Genre & GenreProps);

    book.update({ genres: [addGenre, keepGenre] });
    expect(book.genres.toRefArray().map((row: TableRow) => row.id)).toEqual([
      1,
      2,
    ]);

    expect(deleteGenre.books.filter({ id: book.id }).exists()).toBe(false);
  });

  it("creating models without many-to-many entities works", () => {
    const { Book } = session;
    expect(() => {
      Book.create({ id: 457656121 });
    }).not.toThrow();
  });

  it("creating models throws when passing non-array many field", () => {
    const { Book } = session;
    [null, undefined, 353, "a string"].forEach((value) => {
      expect(() => {
        Book.create({ id: 457656121, genres: value });
      }).toThrow(
        `Failed to resolve many-to-many relationship: Book[genres] must be an array (passed: ${value})`
      );
    });
  });

  it("updating models without many-to-many entities works", () => {
    const { Book } = session;
    const book = Book.create({ id: 457656121 });
    expect(() => {
      book.update({ id: 457656121 });
    }).not.toThrow();
  });

  it("update throws with non-array many field", () => {
    const { Book } = session;
    const book = Book.create({ id: 457656121 });
    [null, undefined, 353, "a string"].forEach((value) => {
      expect(() => {
        book.update({ genres: value });
      }).toThrow(
        `Failed to resolve many-to-many relationship: Book[genres] must be an array (passed: ${value})`
      );
    });
  });

  it("removing related many-to-many entities works", () => {
    const { Book, Genre } = session;
    const book = Book.withId(0)! as unknown as (typeof Book & BookProps);
    expect(book.genres.count()).toBe(2);
    book.genres.remove(Genre.withId(0)!);

    expect((session.Book.withId(0)! as unknown as (typeof Book & BookProps)).genres.count()).toBe(1);
  });

  it("trying to remove unexisting related many-to-many entities throws", () => {
    const { Book } = session;
    const book = Book.withId(0)! as unknown as (typeof Book & BookProps);

    const unexistingId = 2012384;
    expect(() => book.genres.remove(0, unexistingId)).toThrow(
      unexistingId.toString()
    );
  });

  it("clearing related many-to-many entities works", () => {
    const { Book } = session;
    const book = Book.withId(0)! as unknown as (typeof Book & BookProps);;
    expect(book.genres.count()).toBe(2);
    book.genres.clear();

    expect((session.Book.withId(0)! as unknown as (typeof Book & BookProps)).genres.count()).toBe(0);
  });

  it("foreign key relationship descriptors work", () => {
    const { Book, Author, Movie, Publisher } = session;

    // Forward
    const book = Book.first()! as unknown as (Book & BookProps);
    const { author } = book;
    const { author: rawFk } = book.ref;
    expect(author).toBeInstanceOf(Author);
    expect(author.getId()).toBe(rawFk);

    // Backward
    const relatedBooks = author.books;
    expect(relatedBooks).toBeInstanceOf(QuerySet);
    relatedBooks._evaluate();
    expect(relatedBooks.rows).toContain(book.ref);
    expect(relatedBooks.modelClass).toBe(Book);

    // Forward with 'as' option
    const movie = Movie.first()! as unknown as (Movie & MovieProps);
    const { publisher, publisherId } = movie;
    expect(publisher).toBeInstanceOf(Publisher);
    expect(publisher.getId()).toBe(publisherId);
  });

  it("non-existing foreign key relationship descriptors return null", () => {
    const { Book } = session;

    const book = Book.first()! as unknown as (Book & BookProps);
    (book as WithSetter).author = 91243424;
    expect(book.author).toBe(null);

    (book as WithSetter).author = null;
    expect(book.author).toBe(null);
  });

  it("setting forwards foreign key (many-to-one) field works", () => {
    const { Book, Author, Movie, Publisher } = session;

    const book = Book.first()! as unknown as (Book & BookProps);
    const newAuthor = Author.withId(2)! as unknown as (Author & AuthorProps);

    book.author = newAuthor;

    expect(book.author).toEqual(newAuthor);
    expect(book.author.ref).toBe(newAuthor.ref);

    // with 'as' option
    const movie = Movie.first()! as unknown as (typeof Movie & MovieProps);
    const newPublisher = Publisher.withId(0)! as unknown as (PublisherType & PublisherProps);
    movie.publisher = newPublisher;

    expect(movie.publisherId).toEqual(0);
    expect(movie.publisher).toEqual(newPublisher);
    expect(movie.publisher.ref).toBe(newPublisher.ref);
  });

  // it("trying to set backwards foreign key (reverse many-to-one) field throws", () => {
  //   const { Book } = session;

  //   const book = Book.first()!;
  //   expect(() => {
  //     (book as WithSetter).author.books = "whatever";
  //   }).toThrow("Can't mutate a reverse many-to-one relation.");
  // });

  it("one-to-one relationship descriptors work", () => {
    const { Book, Cover } = session;

    // Forward
    const book = Book.first()! as unknown as (Book & BookProps);
    const { cover } = book;
    const { cover: rawFk } = book.ref;
    expect(cover).toBeInstanceOf(Cover);
    expect(cover.getId()).toBe(rawFk);

    // Backward
    const relatedBook = cover.book;
    expect(relatedBook).toBeInstanceOf(Book);
    expect(relatedBook.getId()).toBe(book.getId());
  });

  // it("trying to set backwards one-to-one field throws", () => {
  //   const { Book } = session;

  //   const book = Book.first()! as unknown as (Book & BookProps);
  //   expect(() => {
  //     book.cover.book = "whatever";
  //   }).toThrow("Can't mutate a reverse one-to-one relation.");
  // });

  it("applying no updates returns the same state reference", () => {
    const book = session.Book.first()! as unknown as (Book & BookProps);
    book.name = book.name;

    expect(session.state).toBe(state);
  });

  it("Model works with default value", () => {
    let returnId = 1;

    class DefaultFieldModel extends Model {
      static modelName = "DefaultFieldModel";
      static fields = {
        id: attr({ getDefault: () => returnId }),
      };
    }

    const _orm = new ORM();
    _orm.register(DefaultFieldModel);

    const sess = (_orm.session(_orm.getEmptyState()) as unknown) as Session & {
      DefaultFieldModel: typeof DefaultFieldModel;
    };
    sess.DefaultFieldModel.create({});

    expect(sess.DefaultFieldModel.idExists(1)).toBe(true);

    returnId = 999;
    sess.DefaultFieldModel.create({});
    expect(sess.DefaultFieldModel.idExists(999)).toBe(true);
  });
});
