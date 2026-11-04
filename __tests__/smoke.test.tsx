// The one passing test a freshly-initialized harness requires (see docs/
// Technical_Requirements.md's "three layers"). Replace/extend per feature as
// real screens land - this just proves the toolchain works end to end.
test("the test runner itself works", () => {
  expect(1 + 1).toBe(2);
});
