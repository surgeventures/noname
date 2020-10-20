# API

This library simplifies formatting `data objects` (objects that are used within application) to JSON:API documents, as well as parsing JSON:API documents into corresponding data objects.

All usage examples in this document use the same blog API described in the [introduction](/docs/intro.md).

## Registry

`Registry` object serves as a point of interaction with the library. It holds definitions of API resources, global options, and provides methods for parsing and formatting JSON:API documents.

### constructor(options)

Constructs a new registry object.

- `options.keyTransform` - specifies how resource field names are transformed globally

If `keyTransform` option is omitted, attribute and relationship names are copied as is to the resulting resource object. If the option was set to `'kebab'`, attribute names of data objects are automatically transformed from camelCase to kebab-case field names of the resource objects.

Usage:

```js
import { Registry } from "@mykulyak/json-api/dist";

const registry = new Registry({ keyTransform: "kebab" });
```

### define(type, spec)

Defines [JSON:API resource](https://jsonapi.org/format/#document-resource-objects) with given `type` and specification.

- `type` **required** string, resource type
- `spec` **required** object, resource specification

Function returns a newly created `Resource` object.

Usage:

```js
const commentResource = registry.define('comment', {
  attributes: ['nickname', 'text', 'published'],
  relationships: {
    article: 'article'
  }
});
```

### Resource specification

Resource specification is a plain JavaScript object that determines how attributes of data object will be mapped to field names of the JSON:API resource objects, and vice versa. Specification has two attributes:

- `id` specification for resource ID
- `attributes` **required** specifications for resource attribute
- `relationships` **required** specifications for resource relationships

#### Resource identifiers

Default behaviour

During formatting, if the ID attribute of the data object is `undefined`, resource object will not have the `id` field . If the ID attribute of the data object is `null`, resource object will also have its `id` field set to `null`. In other cases, resource identifier value will be formed by stringifying the ID attribute of the data object.

During parsing, if the resource identifier is `null` or `undefined`, ID attribute of the data object is set to `null`. Otherwise, ID attribute is evaluated by converting resource ID to number.

Default behaviour can be customized by passing `id` specification for resource ID. For example, let's imagine that we have `country` resource those data object looks like:

```json
{
  "code": "GB",
  "name": "Great Britain"
}
```

Because "code" is a natural country identifier, corresponding resource could be defined like:

```js
registry.define("country", {
  id: {
    attr: "code",
    format: value => value,
    parse: resourceObj => resourceObj.id,
  }
});
```

#### Attribute specifications

For each resource attribute one can specify how it is extracted from data object, and how it will be formatted. Process of formatting attributes is two step:

- firstly, data value is extracted using `getter(data, key)` function. It is passed 2 arguments, first of which is the data object and the second is the name of the attribute in the resource object
- secondly, data value is formatetd using `formatter(value)` function

By default, getter extracts value from the same attribute in the data object as the attribute in the resource object. Specifying custom getter function is useful when name of the attribute in the resource is not the same as in the data object.

Usage:

```js
attributes: {
  name: {
    getter: (data, key) => `${data.firstName} ${data.lastName}`,
    formatter: value => value.trim(),
  },
  email: {
    getter: (data, key) => data[key],
    formatter: value => value
  }
}
```

There is also a shortcut form:

```js
attributes: ['name', 'email']
```

which is equivalent to mapping name and email attributes without any transformation.

#### Specifying relationships

Relationships specification should be an object those keys identify resource relationships, and values determine how relationship values are to be formatted or parsed. Value could be a string, a `Resource` object or a plain object with `type` and `_embed` field.

Example:

```js
relationships: {
  author: "author",
  comments: {
    type: "comment",
    _embed: true
  },
}
```

If specification value is string, it is treated as the resource type to be used for parsing and formatting.

If specification value is a `Resource`, it is used for parsing and formatting.

If specification value is an object, its `type` field is treated as the resource type, and its `_embed` flag is used for non-standard functionality of embedding resources directly in the relationships.

### find(type)

Finds and returns `Resource` object for given resource type.

- `type` **required** string, resource type

Function returns a `Resource` object corresponding to given `type`, or undefined if there was no resource defined for this type.

Usage:

```js
const authorResource = registry.find("author");
```

### format(type, data)

Formats JSON:API document for given type of top-level resource and data object.

- `type` **required** string, resource type
- `data` **required** data object or an array of data objects, which will become the document primary data

Function returns formatted JSON:API document

Usage:

```js
registry.format("author", {
  id: 12,
  name: "Jane Dow",
  email: "second@example.com",
  articles: [12, 14, 16]
})
```

will output

```json
{
  "data": {
    "type": "author",
    "id": "12",
    "attributes": {
      "name": "Jane Dow",
      "email": "second@example.com"
    },
    "relationships": {
      "articles": [
        { "type": "article", "id": "12" },
        { "type": "article", "id": "14" },
        { "type": "article", "id": "16" }
      ]
    }
  },
  "jsonapi": { "version": "1.0" }
}
```

### parse(document)

Parses JSON:API document.

- `document` **require** object, proper JSON:API document

Usage:

```js
registry.parse({
  data: {
    type: "article",
    id: "12",
    attributes: {
      title: "What is 42 ?",
      text: "Answer to the Ultimate Question of Life, The Universe, and Everything"
    },
    relationships: {
      author: {
        data: { type: "author", id: "1" }
      },
      comments: {
        data: [
          { type: "comment", id: "121" },
          { type: "comment", id: "122" }
        ]
      }
    }
  },
  jsonapi: { version: "1.0" }
})
```

will output

```json
{
  "id": 12,
  "title": "What is 42 ?",
  "text": "Answer to the Ultimate Question of Life, The Universe, and Everything",
  "author": 1,
  "comments": [121, 122]
}
```

## Resource

Encapsulates information about formatting/parsing rules for single JSON:API resource.

### link(resourceId)

Formats [resource link](https://jsonapi.org/format/#document-resource-object-identification).

- `resourceId` **required** `null`, `string` or `number`, an ID of the resource

Usage:

```js
authorResource.link(123)
```

will output

```json
{
  "type": "author",
  "id": "123"
}
```

### resource(data)

Formats a single [resource object](https://jsonapi.org/format/#document-resource-object-identification).

- `data` **required** resource data

Usage:

```js
commentResource.resource({
  id: 121,
  nickname: "John Dow",
  published: "2020-01-01",
  text: "Very nice"
})
```

will output

```json
{
  "type": "comment",
  "id": "121",
  "attributes": {
    "nickname": "John Dow",
    "published": "2020-01-01",
    "text": "Very nice"
  }
}
```

### document(dataObj)

Formats [document](https://jsonapi.org/format/#document-structure) whose top level `data` attributes will consists of resources formatted from `dataObj`.

### parse(jsonApiData, includesMap = null, options = null)

Parses [document](https://jsonapi.org/format/#document-structure) or [resource object](https://jsonapi.org/format/#document-resource-objects).

- `jsonApiData` **required** object, document or resource data
- `includesMap` hash of included data, whose keys are like `type:id`, and values are parsed included resources
- `options.typeAttr` - if set, library will add attribute with such a name for each parsed resource, and will set its value to resource type. If not set (the default behaviour), resource types will not be set.
- `options.includedInResponse` - if set, library will add parsed include to response.
