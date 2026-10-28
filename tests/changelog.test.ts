import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parseChangelog } from "../src/app/domain/changelog";
test("release-note screenshot references exist and only local assets can become images", () => {
  const blocks = parseChangelog(readFileSync("CHANGELOG.md", "utf8"));
  const pictures = blocks.filter((b) => b.kind === "image");
  assert.equal(pictures.length, 4);
  for (const p of pictures) {
    assert.ok(existsSync(p.src!.slice(1)));
    assert.ok(p.text);
    assert.ok(p.caption);
  }
  assert.equal(
    parseChangelog("![bad](https://example.org/image.png)").some(
      (b) => b.kind === "image",
    ),
    false,
  );
  assert.equal(
    parseChangelog("![bad](docs/changelog/assets/../secret.png)").some(
      (b) => b.kind === "image",
    ),
    false,
  );
});
