# Introduction

Say, you need to write a simple SPA blog app whose API has to be designed according to [JSON:API specification](https://jsonapi.org/format/). Although JSON:API is very flexible and powerful, its data format is pretty much verbose. It is simply inconvenient to manually convert between simple JSON objects your app uses and JSON:API resources. That's where this library can help.

## Model your data

You start with designing resources your blog API will expose. In this case they are quite natuarally `articles`, `authors` and `comments`:

- author has `name` and `email` attributes
- author may have zero or more `articles`
- article has `title`, `text` and `published` attribites, and exactly one `author`
- article may have zero or more `comments`
- comment has `text`, `nickname` and `published` attributes
- comment is related to exactly one `article`

You also choose the most natural shape of data objects used internally:

```js
const author = {
  id: 12,
  name: "John Dow",
  email: "first@example.com",
};

const article = {
  title: "Why should I use JSON:API",
  text: "Because it is very flexible and powerful",
  authorId: 12,
  comments: [
    { id: 1, nickname: "Mr. Smith", text: "Awesome !", published: "2020-03-21" },
    { id: 2, nickname: "Mrs. Smith", text: "Very good argument", published: "2020-03-22" },
  ]
};
```

## Design API resources

First, we need `registry`, an object which will hold definitions of our API resources and will act as an interaction point with the library.

```js
import { Registry } from "@mykulyak/json-api";

const registry = new Registry({ transformKey: "kebab" });
```

Having registry we can define how `resources` should be formatted and parsed.

```js
registry.define("author", {
  attributes: ["name", "email"],
  relationships: {
    articles: "article"
  }
});

registry.define("article", {
  attributes: ["title", "text", "published"],
  relationships: {
    author: "author",
    comments: "comment"
  }
});

registry.define("comment", {
  attributes: ["nickname", "text", "published"],
  relationships: {
    article: "article"
  }
});
```

## Format JSON:API documents

With resources defined, you can use `registry.format` to build JSON:API document from internal data object. For example,

```js
registry.format("author", {
  id: 12,
  name: "John Dow",
  email: "john.dow@example.com",
  articles: [1, 2, 3]
});
```

will return

```js
{
  type: "author",
  id: "12",
  attributes: {
    name: "John Dow",
    email: "john.dow@example.com"
  },
  relationships: {
    articles: {
      data: [
        { type: "article", id: "1" },
        { type: "article", id: "2" },
        { type: "article", id: "3" }
      ]
    }
  }
}
```

## Parse JSON:API documents

We can also parse JSON:API documents to internal representation using `registry.parse`. For example,

```js
registry.parse({
  data: {
    type: "article",
    id: "191",
    attributes: {
      title: "Why should I use JSON:API",
      text: "Because it is very flexible and powerful",
    },
    relationships: {
      author: {
        data: {
          type: "author",
          id: "19"
        }
      },
      comments: {
        data: [
          { type: "comment", id: "1" },
          { type: "comment", id: "2" }
        ]
      }
    }
  },
  included: [
    {
      type: "author",
      id: "19",
      attributes: {
        name: "John Dow",
        email: "john.dow@example.com"
      }
    },
    {
      type: "comment",
      id: "1",
      attributes: {
        nickname: "Mr. Smith",
        text: "Awesome !",
        published: "2020-03-21"
      }
    },
    {
      type: "comment",
      id: 2,
      attributes: {
        nickname: "Mrs. Smith",
        text: "Very good argument",
        published: "2020-03-22"
      },
    }
  ],
  jsonapi: { version: "1.0" }
});
```

will output

```js
{
  id: 191,
  title: "Why should I use JSON:API",
  text: "Because it is very flexible and powerful",
  author: {
    id: 19,
    name: "John Dow",
    email: "john.dow@example.com"
  },
  comments: [
    {
      id: 1,
      nickname: "Mr. Smith",
      text: "Awesome !",
      published: "2020-03-21"
    },
    {
      id: 2,
      nickname: "Mrs. Smith",
      text: "Very good argument",
      published: "2020-03-22"
    }
  ]
}
```
