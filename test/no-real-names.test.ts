import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 公開リポジトリと npm に、実在の公開カレンダーの名前を入れない（誰がどのカレンダーを見ているかが分かるため）。
// 見本の名前は example_band だけにする
const ALLOWED = new Set(["example_band"]);
const FILES = [
	...["src", "test"].flatMap((dir) => readdirSync(dir).map((name) => join(dir, name))),
	"README.md",
	"AGENTS.md",
];

test("公開カレンダーの名前は、見本の example_band だけ", () => {
	const found = FILES.flatMap((file) =>
		[...readFileSync(file, "utf8").matchAll(/public_calendars\/([A-Za-z0-9_-]+)/g)]
			.map((m) => m[1] ?? "")
			.filter((name) => !ALLOWED.has(name))
			.map((name) => `${file}: ${name}`),
	);
	expect(found).toEqual([]);
});
