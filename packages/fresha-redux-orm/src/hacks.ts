// Used in places where typings are not precise enough.
// Should be treated as temporary code.
export function castTo<T>(arg: unknown): T {
  return arg as T;
}
