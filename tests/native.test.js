import test from "node:test";
import assert from "node:assert/strict";
import { shareNativeFile, isNative } from "../src/native.js";
import { readFile } from "node:fs/promises";

// Exercise the native export boundary without needing a device or exposing
// external storage. The real plugin integration is compiled by Android CI.
test("native exports write UTF-8 privately and share only the returned URI", async () => {
  const calls = [];
  await shareNativeFile("Cabinet-部品.json", '{"label":"Shelf 部品"}', {
    Filesystem: {
      async writeFile(options) {
        calls.push(["write", options]);
        return { uri: "file:///cache/exports/Cabinet-部品.json" };
      },
    },
    Share: {
      async share(options) {
        calls.push(["share", options]);
      },
    },
  });
  assert.equal(calls[0][0], "write");
  assert.equal(calls[0][1].directory, "CACHE");
  assert.equal(calls[0][1].encoding, "utf8");
  assert.equal(calls[0][1].path, "exports/Cabinet-部品.json");
  assert.equal(calls[0][1].data, '{"label":"Shelf 部品"}');
  assert.deepEqual(calls[1][1].files, [
    "file:///cache/exports/Cabinet-部品.json",
  ]);
});

test("native export rejects paths and propagates errors for a visible UI message", async () => {
  for (const filename of [
    "../secret",
    "folder/file",
    "folder\\file",
    "",
    ".",
    "..",
  ]) {
    await assert.rejects(() => shareNativeFile(filename, "data"), /filename/);
  }
  await assert.rejects(
    () =>
      shareNativeFile("parts.csv", "data", {
        Filesystem: {
          async writeFile() {
            throw new Error("Storage full");
          },
        },
        Share: {
          async share() {
            assert.fail("Must not share after a failed write");
          },
        },
      }),
    /Storage full/,
  );
  assert.equal(isNative(), false);
});

test("Android uses bundled assets, a unique package and restricted export access", async () => {
  const config = JSON.parse(await readFile("capacitor.config.json", "utf8"));
  assert.equal(config.appId, "io.github.leonbalongo.cutcraft");
  assert.equal(config.webDir, "dist");
  assert.equal(config.server?.url, undefined);
  assert.equal(config.android.allowMixedContent, false);
  const paths = await readFile(
    "android/app/src/main/res/xml/file_paths.xml",
    "utf8",
  );
  assert.match(paths, /path="exports\/"/);
  assert.doesNotMatch(paths, /external-path/);
  const manifest = await readFile(
    "android/app/src/main/AndroidManifest.xml",
    "utf8",
  );
  assert.match(manifest, /android:allowBackup="false"/);
  assert.doesNotMatch(
    manifest,
    /BILLING|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE/,
  );
});
