/** @type {import("lint-staged").Configuration} */
export default {
  "*.{ts,tsx,mjs,json,css,md}": "prettier --write",
  "*.{ts,tsx,mjs}": `eslint --fix`,
};
