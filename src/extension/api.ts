export const api = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser ?? chrome;
