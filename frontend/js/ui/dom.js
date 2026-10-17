// Tiny DOM helper shared by the pages.
export const $ = (selector, root = document) => root.querySelector(selector);
