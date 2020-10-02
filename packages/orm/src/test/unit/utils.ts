import {
  arrayDiffActions,
  m2mName,
  m2mFromFieldName,
  m2mToFieldName,
  reverseFieldName,
  normalizeEntity,
  objectShallowEquals,
  clauseFiltersByAttribute,
  ArrayDiffActionsResult
} from "../../utils";
import { FILTER } from "../../constants";
import { Model } from "../../index";

describe("Utils", () => {
  describe("arrayDiffActions", () => {
    it("normal case", () => {
      const target = [2, 3];
      const source = [1, 2, 4];

      const actions = arrayDiffActions(source, target) as ArrayDiffActionsResult;
      expect(actions.add).toEqual([3]);
      expect(actions.delete).toEqual([1, 4]);
    });

    it("only add", () => {
      const target = [2, 3];
      const source = [2];

      const actions = arrayDiffActions(source, target) as ArrayDiffActionsResult;
      expect(actions.add).toEqual([3]);
      expect(actions.delete).toEqual([]);
    });

    it("only remove", () => {
      const target = [2, 3];
      const source = [2, 3, 4];

      const actions = arrayDiffActions(source, target) as ArrayDiffActionsResult;
      expect(actions.add).toEqual([]);
      expect(actions.delete).toEqual([4]);
    });

    it("identical", () => {
      const target = [2, 3];
      const source = [2, 3];

      const actions = arrayDiffActions(source, target);
      expect(actions).toBe(null);
    });
  });

  describe("m2mName", () => {
    it("returns combined string", () => {
      expect(m2mName("", "")).toBe("");
      expect(m2mName("ModelA", "")).toBe("ModelA");
      expect(m2mName("Author", "books")).toBe("AuthorBooks");
      expect(m2mName("mOVIE", "Actors")).toBe("mOVIEActors");
    });
  });

  describe("m2mFromFieldName", () => {
    it("returns combined string", () => {
      expect(m2mFromFieldName("")).toBe("fromId");
      expect(m2mFromFieldName("ModelA")).toBe("fromModelAId");
      expect(m2mFromFieldName("Author")).toBe("fromAuthorId");
      expect(m2mFromFieldName("mOVIE")).toBe("frommOVIEId");
    });
  });

  describe("m2mToFieldName", () => {
    it("returns combined string", () => {
      expect(m2mToFieldName("")).toBe("toId");
      expect(m2mToFieldName("ModelA")).toBe("toModelAId");
      expect(m2mToFieldName("Author")).toBe("toAuthorId");
      expect(m2mToFieldName("mOVIE")).toBe("tomOVIEId");
    });
  });

  describe("reverseFieldName", () => {
    it("returns combined string", () => {
      expect(reverseFieldName("")).toBe("Set");
      expect(reverseFieldName("ModelA")).toBe("modelaSet");
      expect(reverseFieldName("Author")).toBe("authorSet");
      expect(reverseFieldName("mOVIE")).toBe("movieSet");
    });
  });

  describe("normalizeEntity", () => {
    let Book: typeof Model;
    beforeEach(() => {
      Book = class BookModel extends Model {
        static get idAttribute() {
          return "title";
        }
      };
    });

    it("returns id of model instances", () => {
      const book = new Book({ title: "book title" });
      expect(normalizeEntity(book)).toBe("book title");
    });

    it("does not modify other values", () => {
      expect(normalizeEntity(null)).toBe(null);
      expect(normalizeEntity(undefined)).toBe(undefined);
      expect(normalizeEntity(123)).toBe(123);
      expect(normalizeEntity("some string")).toBe("some string");
      expect(normalizeEntity({})).toEqual({});
      expect(normalizeEntity([])).toEqual([]);
    });
  });

  describe("objectShallowEquals", () => {
    it("normal case", () => {
      expect(objectShallowEquals({}, {})).toBe(true);
      expect(
        objectShallowEquals(
          {
            someAttribute: "someValue",
          },
          {
            someAttribute: "someValue",
          }
        )
      ).toBe(true);
      expect(
        objectShallowEquals(
          {
            someAttribute: "someValue",
            secondAttribute: "secondValue",
          },
          {
            someAttribute: "otherValue",
          }
        )
      ).toBe(false);
      expect(
        objectShallowEquals(
          {
            someAttribute: "someValue",
          },
          {
            someAttribute: "otherValue",
          }
        )
      ).toBe(false);
    });
    it("false for equal array keys", () => {
      // the arrays are referentially unequal
      expect(
        objectShallowEquals(
          {
            someAttribute: [],
          },
          {
            someAttribute: [],
          }
        )
      ).toBe(false);
    });
    it("false for equal object keys", () => {
      // the objects are referentially unequal
      expect(
        objectShallowEquals(
          {
            someAttribute: {},
          },
          {
            someAttribute: {},
          }
        )
      ).toBe(false);
    });
  });

  describe("clauseFiltersByAttribute", () => {
    it("normal case", () => {
      expect(
        clauseFiltersByAttribute(
          {
            type: FILTER,
            payload: {
              someAttribute: "someValue",
            },
          },
          "someAttribute"
        )
      ).toBe(true);
    });

    // it("false if type is not filter", () => {
    //   expect(clauseFiltersByAttribute({})).toBe(false);
    //   expect(clauseFiltersByAttribute({}, "")).toBe(false);
    //   expect(clauseFiltersByAttribute({ type: "not filter" }, "")).toBe(false);
    //   expect(
    //     clauseFiltersByAttribute(
    //       {
    //         type: "not filter",
    //         payload: {
    //           someAttribute: "someValue",
    //         },
    //       },
    //       "someAttribute"
    //     )
    //   ).toBe(false);
    // });

    it("false if attribute value is not specified", () => {
      expect(
        clauseFiltersByAttribute(
          {
            type: FILTER,
            payload: {
              someAttribute: null,
            },
          },
          "someAttribute"
        )
      ).toBe(false);
      expect(
        clauseFiltersByAttribute(
          {
            type: FILTER,
            payload: {},
          },
          "someAttribute"
        )
      ).toBe(false);
    });
  });
});
