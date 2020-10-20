import Registry, { KeyTransforms } from "./Registry";

describe("Registry.define", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  it("should be able to define a new resource", () => {
    const resource = registry.define("test", {});
    expect(resource).not.toBeNull();
  });
});

describe("Registry.format", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();

    registry.define("existing", {
      attributes: ["attr"]
    });
  });

  it("should format documents", () => {
    expect(registry.format("existing", { id: 1, attr: "A" })).toEqual({
      data: {
        type: "existing",
        id: "1",
        attributes: {
          attr: "A"
        }
      }
    });
  });

  it("throws an error when given unknown resource type", () => {
    expect(() => {
      registry.format("unknown", {});
    }).toThrow();
  });
});

describe("Registry.parse", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry({ keyTransform: KeyTransforms.Kebab });

    registry.define("survey-resource-type", {
      attributes: ["title", "startDate", "endDate"]
    });

    registry.define("parent", {
      relationships: {
        children: "children"
      }
    });

    registry.define("children", {
      relationships: {
        parent: "parent",
        children: "grandchildren"
      }
    });

    registry.define("grandchildren", {
      relationships: {
        parent: "children"
      }
    });

    registry.define("terminals", {
      relationships: {
        parent: "terminals"
      }
    });
  });

  it("should parse single resource with attributes", () => {
    expect(
      registry.parse({
        data: {
          type: "survey-resource-type",
          id: "12",
          attributes: {
            title: "First survey",
            "start-date": "2020-01-01",
            "end-date": "2020-01-31"
          }
        }
      })
    ).toEqual({
      id: "12",
      title: "First survey",
      startDate: "2020-01-01",
      endDate: "2020-01-31"
    });
  });

  it("should parse multiple resources with attributes only", () => {
    expect(
      registry.parse({
        data: [
          {
            type: "survey-resource-type",
            id: "12",
            attributes: {
              title: "First"
            }
          },
          {
            type: "survey-resource-type",
            id: "34",
            attributes: {
              title: "Second"
            }
          }
        ]
      })
    ).toEqual([
      { id: "12", title: "First" },
      { id: "34", title: "Second" }
    ]);
  });

  it("parses null relationship", () => {
    expect(
      registry.parse({
        data: {
          type: "parent",
          id: "12",
          relationships: {
            children: {
              data: null
            }
          }
        }
      })
    ).toEqual({
      id: "12",
      children: null
    });
  });

  it("parses single object relationship", () => {
    expect(
      registry.parse({
        data: {
          type: "parent",
          id: "12",
          relationships: {
            children: {
              data: {
                type: "children",
                id: "123"
              }
            }
          }
        }
      })
    ).toEqual({
      id: "12",
      children: "123"
    });
  });

  it("parses single relationship using includes map", () => {
    expect(
      registry.parse({
        data: {
          type: "parent",
          id: "12",
          relationships: {
            children: {
              data: {
                type: "children",
                id: "123"
              }
            }
          }
        },
        included: [
          {
            type: "children",
            id: "123"
          }
        ]
      })
    ).toEqual({
      id: "12",
      children: { id: "123" }
    });
  });

  it("parses single relationship with additional included", () => {
    const response = registry.parse(
      {
        data: {
          type: "parent",
          id: "12",
          relationships: {
            children: {
              data: {
                type: "children",
                id: "123"
              }
            }
          }
        },
        included: [
          {
            type: "children",
            id: "123"
          },
          {
            type: "terminals",
            id: "1234",
            relationships: {
              location: {
                data: {
                  id: "12",
                  type: "locations"
                }
              }
            }
          }
        ]
      },
      { includedInResponse: true }
    );

    expect(response).toEqual([
      {
        id: "12",
        children: { id: "123" }
      },
      { id: "123" },
      {
        id: "1234",
        location: "12"
      }
    ]);
  });

  it("parses included with resource type", () => {
    const response = registry.parse(
      {
        data: {
          type: "parent",
          id: "12",
          relationships: {
            children: {
              data: {
                type: "children",
                id: "123"
              }
            }
          }
        },
        included: [
          {
            type: "children",
            id: "123"
          },
          {
            type: "terminals",
            id: "1234",
            relationships: {
              location: {
                data: {
                  id: "12",
                  type: "locations"
                }
              }
            }
          }
        ]
      },
      { includedInResponse: true, typeAttr: "type_" }
    );

    expect(response).toEqual([
      {
        id: "12",
        type_: "parent",
        children: { id: "123", type_: "children" }
      },
      { id: "123", type_: "children" },
      {
        id: "1234",
        location: "12",
        type_: "terminals"
      }
    ]);
  });

  it("parses multiple relationship", () => {
    expect(
      registry.parse({
        data: {
          type: "parent",
          id: "12",
          relationships: {
            children: {
              data: [
                {
                  type: "children",
                  id: "123"
                },
                {
                  type: "children",
                  id: "125"
                },
                {
                  type: "children",
                  id: "127"
                }
              ]
            }
          }
        }
      })
    ).toEqual({
      id: "12",
      children: ["123", "125", "127"]
    });
  });

  it("parses multiple relationship using includes map", () => {
    expect(
      registry.parse({
        data: {
          type: "parent",
          id: "12",
          relationships: {
            children: {
              data: [
                {
                  type: "children",
                  id: "123"
                },
                {
                  type: "children",
                  id: "125"
                },
                {
                  type: "children",
                  id: "127"
                }
              ]
            }
          }
        },
        included: [
          {
            type: "children",
            id: "123"
          },
          {
            type: "children",
            id: "125"
          },
          {
            type: "children",
            id: "127"
          }
        ]
      })
    ).toEqual({
      id: "12",
      children: [{ id: "123" }, { id: "125" }, { id: "127" }]
    });
  });

  it("parses nested relationships", () => {
    expect(
      registry.parse({
        data: {
          type: "parent",
          id: "12",
          relationships: {
            children: {
              data: {
                type: "children",
                id: "123"
              }
            }
          }
        },
        included: [
          {
            type: "children",
            id: "123",
            relationships: {
              parent: {
                data: {
                  type: "parent",
                  id: "12"
                }
              },
              children: {
                data: {
                  type: "grandchildren",
                  id: "456"
                }
              }
            }
          },
          {
            type: "grandchildren",
            id: "456",
            relationships: {
              parent: {
                data: {
                  type: "children",
                  id: "123"
                }
              }
            }
          }
        ]
      })
    ).toEqual({
      id: "12",
      children: { id: "123", parent: "12", children: "456" }
    });
  });
});
