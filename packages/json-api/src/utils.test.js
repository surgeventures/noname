import { expect } from "chai";

import { kebabCase, kebabCaseDeep, camelCase } from "./utils";

describe("kebabCase", () => {
  it("should convert strings to kebab case", () => {
    expect(kebabCase("")).to.equal("");
    expect(kebabCase("testIdent")).to.equal("test-ident");
    expect(kebabCase("TestIdent")).to.equal("test-ident");
    expect(kebabCase("testIdent123")).to.equal("test-ident123");
    expect(kebabCase("test123Ident")).to.equal("test123-ident");
  });
});

describe("camelCase", () => {
  it("should convert strings to camel case", () => {
    expect(camelCase("test-ident")).to.equal("testIdent");
    expect(camelCase("test-123-ident")).to.equal("test123Ident");
  });
});

describe("kebabCaseDeep", () => {
  it("should handle complex objects properly", () => {
    expect(
      kebabCaseDeep({
        keyOne: [
          {
            subKeyOne: "1",
            subKeyTwo: [2, 4]
          }
        ],
        keyTwo: {
          subKeyThree: [
            {
              subSubKeyOne: null
            }
          ],
          subKeyFour: ["valOne", "valueTwo"]
        }
      })
    ).to.deep.equal({
      "key-one": [
        {
          "sub-key-one": "1",
          "sub-key-two": [2, 4]
        }
      ],
      "key-two": {
        "sub-key-three": [
          {
            "sub-sub-key-one": null
          }
        ],
        "sub-key-four": ["valOne", "valueTwo"]
      }
    });
  });
});
