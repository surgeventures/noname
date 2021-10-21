**Minor changes before v1.0.0 can include breaking changes.**

### 0.12.3

* Updated dependencies, most notably Babel v7.
* Set `sideEffects: false` in `package.json` for tree-shaking.
* Replaced some internal usage of lodash by ES6 methods.

### 0.12.2

* Fixed self-referencing many-to-many relationships. They previously caused errors during initialization. ([#226](https://github.com/tommikaikkonen/redux-orm/pull/226))
* Throw error when user attempts to register a model class without a `modelName` set. ([#231](https://github.com/tommikaikkonen/redux-orm/pull/231))
* Throw error when user attempts to interact with the database without a `session`. ([#237](https://github.com/tommikaikkonen/redux-orm/pull/237))
* Fixed tests not running on Windows. ([abe8723](https://github.com/tommikaikkonen/redux-orm/commit/abe87236b4c2755afd8946b70cb199c5aece50b5))
* Drastically increased test coverage and split up tests to make them easier to digest. ([#220](https://github.com/tommikaikkonen/redux-orm/pull/220), [294d5f2](https://github.com/tommikaikkonen/redux-orm/commit/294d5f2a940499c80b613069dd955bb779926659))
* Removed unused methods from Model. ([f9efb8b](https://github.com/tommikaikkonen/redux-orm/commit/f9efb8b2267a674dfea684c196ed13a665b75cdd))

### 0.12.1

* Our exported ES module in `es/` (`pkg.module`) is now ES5 compatible. ([#216](https://github.com/tommikaikkonen/redux-orm/issues/216), [#221](https://github.com/tommikaikkonen/redux-orm/issues/221))
* You can supply an `as` option to foreign key fields (`fk()`) to have Redux-ORM create a separate field for their accessors so as to not override foreign key references ([#219](https://github.com/tommikaikkonen/redux-orm/pull/219)):
```javascript
class Movie extends Model {};
Movie.fields = {
    publisherId: fk({
        to: 'Publisher',
        as: 'publisher',
        relatedName: 'movies',
    }),
};

Publisher.create({ id: 123 });
const movie = Movie.create({ publisherId: 123 });

movie.publisherId // 123
movie.publisher.id === movie.publisherId // true
```

### 0.12.0

- Fixed bug where using the ES5 version with ES6-based model classes would not work. [#213](https://github.com/tommikaikkonen/redux-orm/pull/213)
    - Unfortunately this hotfix contains a performance degradation, so only upgrade if you suffer from the above issue. We are working on an alternative solution.

### 0.11.0

- Potential breaking changes to model API:
    - `Model#equals` is now used by `Model#update` to prevent unnecessary updates in some cases when the intended updates would not change the current model. By default models will always be updated if any of the passed attributes have a different reference than the respective existing attribute. [#204](https://github.com/tommikaikkonen/redux-orm/pull/204)
    - `Model.withId` and resolving foreign key relationships no longer throw an error if the referenced model does not exist. Instead `null` is returned. [#210](https://github.com/tommikaikkonen/redux-orm/pull/210)
    - `Model.exists` now accepts passing a lookup object to check if any model instance matching the passed attributes exists. [#209](https://github.com/tommikaikkonen/redux-orm/pull/209)
    - `Model.hasId` has been replaced by `Model.idExists`. [#209](https://github.com/tommikaikkonen/redux-orm/pull/209)
- Fixed `QuerySet#toString`. [12ce882](https://github.com/tommikaikkonen/redux-orm/commit/12ce882e9ed7fc1ba742e94feb10e82f0968de85)
- Upgraded to reselect v3.0.1. [#208](https://github.com/tommikaikkonen/redux-orm/pull/208)
- Refactored `fields.js`, `descriptors.js` and small parts of `Model.js`. [#210](https://github.com/tommikaikkonen/redux-orm/pull/210)

### 0.10.2

- `pkg.module` now points to a new entrypoint at `es/index.js` adhering to the latest finalized ECMAScript version without non-standard language features. [3ab92b9](https://github.com/tommikaikkonen/redux-orm/commit/3ab92b96e5a5ee43445c542a1bd20589ff32bcd2)
To use the original source in your application, please have your bundler resolve `src/index.js` as defined in `pkg["jsnext:main"]`.

### 0.10.1

- Fixed filter functions not working when using strings as id attributes. [#207](https://github.com/tommikaikkonen/redux-orm/pull/207)

### 0.10.0

- Added memoization by instance. Prevents unnecessary full table scans when not interested in unchanged records. [#185](https://github.com/tommikaikkonen/redux-orm/pull/185)
- Improved performance of many-to-many descriptors. [#165](https://github.com/tommikaikkonen/redux-orm/pull/165)
- Faster model lookups by primary key (id). [#158](https://github.com/tommikaikkonen/redux-orm/pull/158)
- Added `@deprecated` JSDoc tag to deprecated members and functions. [#201](https://github.com/tommikaikkonen/redux-orm/pull/201)
- Added `pkg.module` path to `package.json` indicating path for ES6 module. May fix [#53](https://github.com/tommikaikkonen/redux-orm/issues/53) for some people. [#192](https://github.com/tommikaikkonen/redux-orm/pull/192)
- Introduced dependency on ES2015 `Set`. See [Polyfill](https://github.com/tommikaikkonen/redux-orm#polyfill).
- Added performance regression tests.

### 0.9.4
fix for filter/query [#99](https://github.com/tommikaikkonen/redux-orm/issues/99)

### 0.9.2 - 0.9.3
fix for many-many updates [#136](https://github.com/tommikaikkonen/redux-orm/issues/136)

### 0.9.1
- Added 'upsert' method to Model (insert or update behaviour)
- Major updates for tests
- CI integration

### 0.9.0

A lot. See [the migration guide](https://github.com/tommikaikkonen/redux-orm/wiki/0.9-Migration-Guide).

### 0.8.4

Adds UMD build to partially fix [#41](https://github.com/tommikaikkonen/redux-orm/issues/41). You can now use or try out `redux-orm` through a script tag:

```html
<script src="https://tommikaikkonen.github.io/redux-orm/dist/redux-orm.js"></script>
```

`redux-orm.js` will point to the master version of the library; If you need to stick to a version, make a copy or build it yourself.

### 0.8.3

Fixed bug that mutated the backend options in `Model` if you supplied custom ones, see [Issue 37](https://github.com/tommikaikkonen/redux-orm/issues/37). Thanks to [@diffcunha](https://github.com/diffcunha) for the [fix](https://github.com/tommikaikkonen/redux-orm/pull/38)!

### 0.8.2

Fixed [regression in `Model.prototype.update`](https://github.com/tommikaikkonen/redux-orm/issues/23)

### 0.8.1

Added `babel-runtime to dependencies`

### 0.8.0

Adds **batched mutations.** This is a big performance improvement. Previously adding 10,000 objects would take 15s, now it takes about 0.5s. Batched mutations are implemented using [`immutable-ops`](https://github.com/tommikaikkonen/immutable-ops) internally.

**Breaking changes**:

- Removed `indexById` option from Backend. This means that data will always be stored in both an array of id's and a map of `id => entity`, which was the default setting. If you didn't explicitly set `indexById` to `false`, you don't need to change anything.

- Batched mutations brought some internal changes. If you had custom `Backend` or `Session` classes, or have overridden `Model.getNextState`, please check out the diff.

### 0.7.0

**Breaking changes**:

Model classes that you access in reducers and selectors are now session-specific. Previously the user-defined Model class reference was used for sessions, with a private `session` property changing based on the most recently created session. Now Model classes are given a unique dummy subclass for each session. The subclass will be bound to that specific session. This allows multiple sessions to be used at the same time.

You most likely don't need to change anything. The documentation was written with this feature in mind from the start. As long as you've used the model class references given to you in reducers and selectors as arguments (not the reference to the model class you defined), you're fine.

### 0.6.0

**Breaking changes**:

- When calling `QuerySet.filter` or `QuerySet.exclude` with an object argument, any values of that object that look like a `Model` instance (i.e. they have a `getId` property that is a function), will be turned into the id of that instance before performing the filtering or excluding.

E.g.

```javascript
Book.filter({ author: Author.withId(0) });
```

Is equivalent to

```javascript
Book.filter({ author: 0 });
```

### 0.5.0

**Breaking changes**:

- Model instance method `equals(otherModel)` now checks if the two model's attributes are shallow equal. Previously, it checked if the id's and model classes are equal.
- Session constructor now receives a Schema instance as its first argument, instead of an array of Model classes (this only affects you if you're manually instantiating Sessions with the `new` operator).

Other changes:

- Added `hasId` static method to the Model class. It tests for the existence of the supplied id in the model's state.
- Added instance method `getNextState` to the Session class. This enables you to get the next state without running model-reducers. Useful if you're bootstrapping data, writing tests, or otherwise operating on the data outside reducers. You can pass an options object that currently accepts a `runReducers` key. It's value indicates if reducers should be run or not.
- Improved API documentation.

### 0.4.0

- Fixed a bug that mutated props passed to Model constructors, which could be a reference from the state. I highly recommend updating from 0.3.1.
- API cleanup, see breaking changes below.
- Calling getNextState is no longer mandatory in your Model reducers. If your reducer returns `undefined`, `getNextState` will be called for you.

**Breaking changes**:

- Removed static methods `Model.setOrder()` and `Backend.order`. If you want ordered entities, use the QuerySet instance method `orderBy`.
- Added helpful error messages when trying to add a duplicate many-to-many entry (Model.someManyRelated.add(...)), trying to remove an unexisting many-to-many entry (Model.exampleManyRelated.remove(...)), or creating a Model with duplicate many-to-many entry ids (Model.create(...)).
- Removed ability to supply a mapping function to QuerySet instance method `update`. If you need to record updates dynamically based on each entity, iterate through the objects with `forEach` and record updates separately:

```javascript
const authors = publisher.authors;
authors.forEach(author => {
    const isAdult = author.age >= 18;
    author.update({ isAdult });
})
```

or use the ability to merge an object with all objects in a QuerySet. Since the update operation is batched for all objects in the QuerySet, it can be more performant with a large amount of entities:

```javascript
const authors = publisher.authors;
const isAdult = author => author.age >= 18;

const adultAuthors = authors.filter(isAdult);
adultAuthors.update({ isAdult: true });

const youngAuthors = authors.exclude(isAdult);
youngAuthors.update({ isAdult: false });
```

### 0.3.1

A descriptive error is now thrown when a reverse field conflicts with another field declaration.
For example, the following schema:

```javascript
class A extends Model {}
A.modelName = 'A';

class B extends Model {}
B.modelName = 'B';
B.fields = {
    field1: one('A'),
    field2: one('A'),
};
```

would try to define the reverse field `b` on `A` twice, throwing an error with an undescriptive message.

### 0.3.0

**Breaking changes**:

- `Model.withId(id)` now throws if object with id `id` does not exist in the database. 

### 0.2.0

Includes various bugfixes and improvements.

**Breaking changes**:
- Replaced `plain` and `models` instance attributes in `QuerySet` with `withRefs` and `withModels` respectively. The attributes return a new `QuerySet` instead of modifying the existing one. A `ref` alias is also added for `withRefs`, so you can do `Book.ref.at(2)`.
- After calling `filter`, `exclude` or `orderBy` method on a `QuerySet` instance, the `withRefs` flag is always flipped off so that calling the same methods on the returned `QuerySet` would use model instances in the operations. Previously the flag value remained after calling those methods.
- `.toPlain()` from `QuerySet` is renamed to `.toRefArray()` for clarity.
- Added `.toModelArray()` method to `QuerySet`.
- Removed `.objects()` method from `QuerySet`. Use `.toRefArray()` or `.toModelArray()` instead.
- Removed `.toPlain()` method from `Model`, which returned a copy of the Model instance's property values. To replace that, `ref` instance getter was added. It returns a reference to the plain JavaScript object in the database. So you can do `Book.withId(0).ref`. If you need a copy, you can do `Object.assign({}, Book.withId(0).ref)`.
- Removed `.fromEmpty()` instance method from `Schema`.
- Removed `.setReducer()` instance method from `Schema`. You can just do `ModelClass.reducer = reducerFunc;`.
