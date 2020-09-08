# FAQ

## What if I need to use resource definitions in multiple registries

Use the following recipy:

```js
const defineResources = registry => {
  registry.define('author', {
    // spec ...
  });
  registry.define('article', {
    // spec ...
  });
}

// in the application
defineResources(appRegistry);

// in tests
defineResources(testRegistry);

// etc
```
