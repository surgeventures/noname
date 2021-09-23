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
import { QueryClause } from "../../types";

describe("Utils", () => {
  describe("arrayDiffActions", () => {
    it("normal case", () => {
      const target = [2, 3];
      const source = [1, 2, 4];

      const actions = arrayDiffActions(source, target);
      expect(actions?.add).toEqual<ArrayDiffActionsResult['add']>([3]);
      expect(actions?.delete).toEqual<ArrayDiffActionsResult['delete']>([1, 4]);
    });

    it("only add", () => {
      const target = [2, 3];
      const source = [2];

      const actions = arrayDiffActions(source, target);
      expect(actions?.add).toEqual<ArrayDiffActionsResult['add']>([3]);
      expect(actions?.delete).toEqual<ArrayDiffActionsResult['delete']>([]);
    });

    it("only remove", () => {
      const target = [2, 3];
      const source = [2, 3, 4];

      const actions = arrayDiffActions(source, target);
      expect(actions?.add).toEqual<ArrayDiffActionsResult['add']>([]);
      expect(actions?.delete).toEqual<ArrayDiffActionsResult['delete']>([4]);
    });

    it("identical", () => {
      const target = [2, 3];
      const source = [2, 3];

      const actions = arrayDiffActions(source, target);
      expect(actions).toBe<ReturnType<typeof arrayDiffActions>>(null);
    });
  });

  describe("m2mName", () => {
    it("returns combined string", () => {
      expect(m2mName("", "")).toBe<string>("");
      expect(m2mName("ModelA", "")).toBe<string>("ModelA");
      expect(m2mName("Author", "books")).toBe<string>("AuthorBooks");
      expect(m2mName("mOVIE", "Actors")).toBe<string>("mOVIEActors");
    });
  });

  describe("m2mFromFieldName", () => {
    it("returns combined string", () => {
      expect(m2mFromFieldName("")).toBe<string>("fromId");
      expect(m2mFromFieldName("ModelA")).toBe<string>("fromModelAId");
      expect(m2mFromFieldName("Author")).toBe<string>("fromAuthorId");
      expect(m2mFromFieldName("mOVIE")).toBe<string>("frommOVIEId");
    });
  });

  describe("m2mToFieldName", () => {
    it("returns combined string", () => {
      expect(m2mToFieldName("")).toBe<string>("toId");
      expect(m2mToFieldName("ModelA")).toBe<string>("toModelAId");
      expect(m2mToFieldName("Author")).toBe<string>("toAuthorId");
      expect(m2mToFieldName("mOVIE")).toBe<string>("tomOVIEId");
    });
  });

  describe("reverseFieldName", () => {
    it("returns combined string", () => {
      expect(reverseFieldName("")).toBe<string>("Set");
      expect(reverseFieldName("ModelA")).toBe<string>("modelaSet");
      expect(reverseFieldName("Author")).toBe<string>("authorSet");
      expect(reverseFieldName("mOVIE")).toBe<string>("movieSet");
    });
  });

  describe("normalizeEntity", () => {
    it("returns id of model instances", () => {
      class Book extends Model<typeof Book, { someAttr: string }> {
        static get idAttribute() {
          return "title";
        }
      }
      // ERROR: the issue with idAttribute
      const book = new Book({ title: "book title" } as any);
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

    it("false if type is not filter", () => {
      expect(clauseFiltersByAttribute({} as QueryClause)).toBe(false);
      expect(clauseFiltersByAttribute({ type: "not filter" as any })).toBe(false);
      expect(
        clauseFiltersByAttribute(
          {
            type: "not filter" as any,
            payload: {
              someAttribute: "someValue",
            },
          },
          "someAttribute"
        )
      ).toBe(false);
    });

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
