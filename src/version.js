// The version of the tool itself, shown in the header and written into every save state.
//
// This is the single source: package.json carries the same number, and a test fails when the two
// drift apart. Not to be confused with SAVE_VERSION in src/ui/storage.js, which numbers the save
// file format, or with the version of the record being described.

export const APP_VERSION = '1.0.0';
