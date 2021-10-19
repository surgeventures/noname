import {
  JSONAPIDocument,
  JSONAPIResource,
  JSONAPIResourceAttributes
} from "@fresha/noname-core";
import Registry, { KeyTransforms } from "./Registry";
import { Resource } from "./types";

describe("Resource", () => {
  let registry: Registry;
  let author: Resource;

  beforeEach(() => {
    registry = new Registry();
  });

  describe("id formatting", () => {
    beforeEach(() => {
      author = registry.define("author", {});
    });

    it("properly formats resource ID", () => {
      expect(author.id(12)).toEqual({
        type: "author",
        id: "12"
      });
    });

    it("does not include undefined IDs", () => {
      expect(author.resource({})).toEqual({
        type: "author",
        attributes: {}
      });
    });

    it("allows to override ID formatting & parsing behaviour", () => {
      registry.define("country", {
        id: {
          attr: "code",
          format(value) {
            return value as string;
          },
          parse(resourceObj) {
            return resourceObj.id;
          }
        },
        attributes: ["name"]
      });

      expect(
        registry.format("country", { code: "PL", name: "Poland" })
      ).toEqual({
        data: {
          type: "country",
          id: "PL",
          attributes: {
            name: "Poland"
          }
        }
      });

      expect(
        registry.parse({
          data: {
            type: "country",
            id: "UA",
            attributes: {
              name: "Ukraine"
            }
          }
        })
      ).toEqual({
        code: "UA",
        name: "Ukraine"
      });
    });
  });

  describe("attribute formatting", () => {
    it("uses formatters", () => {
      const custom = registry.define("custom", {
        attributes: {
          age: { formatter: Number },
          skipIfNegative: {
            formatter: x => (typeof x === "number" && x < 0 ? undefined : x)
          }
        }
      });

      expect(
        custom.resource({
          id: 89,
          age: "282",
          skipIfNegative: 10
        })
      ).toEqual({
        type: "custom",
        id: "89",
        attributes: {
          age: 282,
          skipIfNegative: 10
        }
      });

      expect(
        custom.resource({
          id: 89,
          age: "282",
          skipIfNegative: -10
        })
      ).toEqual({
        type: "custom",
        id: "89",
        attributes: {
          age: 282
        }
      });
    });

    it("uses getters", () => {
      const custom = registry.define("custom", {
        attributes: {
          phoneNumber: {
            getter: data => data.mobilePhone
          }
        }
      });

      expect(
        custom.resource({
          id: 12,
          phoneNumber: "736 272 273",
          mobilePhone: "894 999 333"
        })
      ).toEqual({
        type: "custom",
        id: "12",
        attributes: {
          phoneNumber: "894 999 333"
        }
      });
    });
  });

  describe("resource formatting", () => {
    let article: Resource;
    let createArticle: Resource;
    let comment: Resource;

    beforeEach(() => {
      registry.define("author", {
        attributes: ["name", "email"],
        relationships: {
          articles: "article"
        }
      });

      article = registry.define("article", {
        attributes: ["title", "content"],
        relationships: {
          author: "author",
          comments: "comment"
        }
      });

      createArticle = registry.define("create-article", {
        attributes: ["title", "content"]
      });

      comment = registry.define("comment", {
        attributes: ["content"],
        relationships: {
          article: "article"
        }
      });
    });

    it("properly formats resources", () => {
      expect(
        createArticle.resource({
          title: "New article",
          content: "Article content ..."
        })
      ).toEqual({
        type: "create-article",
        attributes: {
          title: "New article",
          content: "Article content ..."
        }
      });
    });

    it("properly formats null relationship", () => {
      expect(
        comment.resource({
          id: 99,
          content: "comment !",
          article: null,
          author: 1245
        })
      ).toEqual({
        type: "comment",
        id: "99",
        attributes: {
          content: "comment !"
        },
        relationships: {
          article: { data: null }
        }
      });
    });

    it("properly formats non-null single relationship", () => {
      expect(
        comment.resource({
          id: 99,
          content: "task",
          article: 12
        })
      ).toEqual({
        type: "comment",
        id: "99",
        attributes: {
          content: "task"
        },
        relationships: {
          article: {
            data: {
              type: "article",
              id: "12"
            }
          }
        }
      });
    });

    it("properly formats empty multiple relationships", () => {
      expect(
        article.document({
          id: 12,
          comments: []
        })
      ).toEqual({
        data: {
          type: "article",
          id: "12",
          attributes: {},
          relationships: {
            author: { data: null },
            comments: { data: [] }
          }
        }
      });
    });

    it("properly formats multiple relationships", () => {
      expect(
        article.document({
          id: 12,
          comments: [1, 5, 9]
        })
      ).toEqual({
        data: {
          type: "article",
          id: "12",
          attributes: {},
          relationships: {
            author: { data: null },
            comments: {
              data: [
                { type: "comment", id: "1" },
                { type: "comment", id: "5" },
                { type: "comment", id: "9" }
              ]
            }
          }
        }
      });
    });
  });
});

describe("Resource.parse", () => {
  let registry: Registry;
  const buildRelatedIncludeResource = ({
    id,
    attributes
  }: {
    id: string;
    attributes: JSONAPIResourceAttributes;
  }) => ({
    type: "nested-child-type",
    id,
    attributes,
    relationships: {
      children: {
        data: { type: "child-type", id: "11" }
      }
    }
  });

  const testDataIncludes: JSONAPIResource[] = [
    {
      type: "child-type",
      id: "11",
      relationships: {
        parent: {
          data: { type: "parent-type", id: "1" }
        }
      }
    }
  ];
  const testData: JSONAPIDocument = {
    data: {
      type: "parent-type",
      id: "1",
      relationships: {
        children: {
          data: [{ type: "child-type", id: "11" }]
        }
      }
    },
    included: testDataIncludes
  };

  beforeEach(() => {
    registry = new Registry({ keyTransform: KeyTransforms.Kebab });
    registry.define("parent-type", {
      attributes: [],
      relationships: {
        children: "child-type"
      }
    });
    registry.define("child-type", {
      attributes: [],
      relationships: {
        parent: "parent-type"
      }
    });

    registry.define("nested-child-type", {
      attributes: ["some-attr"],
      relationships: {
        children: "child-type"
      }
    });
  });

  it("does not include resource type by default", () => {
    expect(registry.parse(testData)).toEqual({
      id: "1",
      children: [
        {
          id: "11",
          parent: "1"
        }
      ]
    });
  });

  it("sets the resource type in the field specified", () => {
    expect(registry.parse(testData, { typeAttr: "type_" })).toEqual({
      type_: "parent-type",
      id: "1",
      children: [
        {
          type_: "child-type",
          id: "11",
          parent: "1"
        }
      ]
    });
  });

  it("properly resolve single nested related resource", () => {
    const parserOptions = { typeAttr: "type_" };
    const parsed = registry.parse(
      {
        ...testData,
        included: [
          ...testDataIncludes,
          buildRelatedIncludeResource({
            id: "122",
            attributes: {
              "some-attr": "some attr value 1"
            }
          })
        ]
      },
      parserOptions
    );
    const expected = {
      type_: "parent-type",
      id: "1",
      children: [
        {
          type_: "child-type",
          id: "11",
          parent: "1",
          nestedChildType: {
            type_: "nested-child-type",
            children: "11",
            id: "122",
            someAttr: "some attr value 1"
          }
        }
      ]
    };
    expect(parsed).toEqual(expected);
  });

  it("properly resolve two nested related resources", () => {
    const parserOptions = { typeAttr: "type_" };
    const parsed = registry.parse(
      {
        ...testData,
        included: [
          ...testDataIncludes,
          buildRelatedIncludeResource({
            id: "122",
            attributes: {
              "some-attr": "some attr value 1"
            }
          }),
          buildRelatedIncludeResource({
            id: "123",
            attributes: {
              "some-attr": "some attr value 2"
            }
          })
        ]
      },
      parserOptions
    );
    const expected = {
      type_: "parent-type",
      id: "1",
      children: [
        {
          type_: "child-type",
          id: "11",
          parent: "1",
          nestedChildType: [
            {
              type_: "nested-child-type",
              children: "11",
              id: "122",
              someAttr: "some attr value 1"
            },
            {
              type_: "nested-child-type",
              children: "11",
              id: "123",
              someAttr: "some attr value 2"
            }
          ]
        }
      ]
    };
    expect(parsed).toEqual(expected);
  });

  it("properly resolve three nested related resources", () => {
    const parsed = registry.parse({
      ...testData,
      included: [
        ...testDataIncludes,
        buildRelatedIncludeResource({
          id: "122",
          attributes: {
            "some-attr": "some attr value 1"
          }
        }),
        buildRelatedIncludeResource({
          id: "123",
          attributes: {
            "some-attr": "some attr value 2"
          }
        }),
        buildRelatedIncludeResource({
          id: "124",
          attributes: {
            "some-attr": "some attr value 3"
          }
        })
      ]
    });
    const expected = {
      id: "1",
      children: [
        {
          id: "11",
          parent: "1",
          nestedChildType: [
            {
              children: "11",
              id: "122",
              someAttr: "some attr value 1"
            },
            {
              children: "11",
              id: "123",
              someAttr: "some attr value 2"
            },
            {
              children: "11",
              id: "124",
              someAttr: "some attr value 3"
            }
          ]
        }
      ]
    };
    expect(parsed).toEqual(expected);
  });

  it("properly resolve missing resources", () => {
    const parsed = registry.parse({
      ...testData,
      included: []
    });
    const expected = {
      id: "1",
      children: ["11"]
    };
    expect(parsed).toEqual(expected);
  });
});

describe("Resource.resource", () => {
  it("handles embedding resources", () => {
    const registry = new Registry({
      keyTransform: KeyTransforms.Kebab
    });

    const author3 = registry.define("author", {
      attributes: ["name"],
      relationships: {
        articles: {
          type: "article",
          _embed: true
        }
      }
    });

    registry.define("article", {
      attributes: ["title"]
    });

    expect(
      author3.document({
        id: 1,
        name: "author",
        articles: [
          { id: 1, title: "first" },
          { id: 2, title: "second" }
        ]
      })
    ).toEqual({
      data: {
        type: "author",
        id: "1",
        attributes: {
          name: "author"
        },
        relationships: {
          articles: {
            data: [
              { type: "article", id: "1", attributes: { title: "first" } },
              { type: "article", id: "2", attributes: { title: "second" } }
            ]
          }
        }
      }
    });
  });
});

describe("Resource.document", () => {
  it("handles transform=kebab option properly", () => {
    const registry = new Registry({
      keyTransform: KeyTransforms.Kebab
    });

    registry.define("author", {
      attributes: ["firstName", "email"],
      relationships: {
        articles: "article"
      }
    });

    const article = registry.define("article", {
      attributes: ["title", "fullContent"],
      relationships: {
        author: "author",
        commentList: "comment"
      }
    });

    registry.define("comment", {
      attributes: ["textContent", "formattedContent"],
      relationships: {
        article: "article"
      }
    });

    expect(
      article.document({
        id: 12,
        title: "Article title",
        fullContent: "Lorem ipsum ... no i tak dalej",
        commentList: [1, 5, 9]
      })
    ).toEqual({
      data: {
        type: "article",
        id: "12",
        attributes: {
          title: "Article title",
          "full-content": "Lorem ipsum ... no i tak dalej"
        },
        relationships: {
          author: { data: null },
          "comment-list": {
            data: [
              { type: "comment", id: "1" },
              { type: "comment", id: "5" },
              { type: "comment", id: "9" }
            ]
          }
        }
      }
    });
  });
});
