export default class DuplicateResourceError extends Error {
  constructor(type: string) {
    super(`Resource ${type} is already defined`);
  }
}
