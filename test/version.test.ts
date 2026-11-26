import { expect, test } from "bun:test";
import pkg from "../package.json" with { type: "json" };
import { VERSION } from "../src/timetree.ts";

// TimeTree への User-Agent に出す版と、npm に出す版がずれないようにする
test("src/timetree.ts の VERSION は package.json の version と同じ", () => {
	expect(VERSION).toBe(pkg.version);
});
