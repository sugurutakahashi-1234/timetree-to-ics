// コマンドの引数・出力・終了コード。TimeTree の代わりに見本を返す（本物を読めるかは週 1 回の live.yml が見る）
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VERSION } from "../src/timetree.ts";

async function run(...args: string[]) {
	const proc = Bun.spawn(["bun", "--preload", "./test/cli-preload.ts", "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
	return { stdout, stderr, code };
}

describe("コマンド", () => {
	test("--help は使い方を出して 0 で終わる", async () => {
		const { stdout, code } = await run("--help");
		expect(code).toBe(0);
		expect(stdout).toContain("使い方: timetree-to-ics");
		expect(stdout).toContain("timetr.ee/p/");
	});

	test("--version は版を出して 0 で終わる", async () => {
		const { stdout, code } = await run("--version");
		expect(code).toBe(0);
		expect(stdout.trim()).toBe(VERSION);
	});

	test("出力先が無ければ、.ics を標準出力に出す", async () => {
		const { stdout, code } = await run("https://timetr.ee/p/example_team");
		expect(code).toBe(0);
		expect(stdout).toStartWith("BEGIN:VCALENDAR\r\n");
		expect(stdout).toContain("SUMMARY:定例ミーティング");
	});

	test("-o で、ファイルに書いて件数を出す", async () => {
		const file = join(mkdtempSync(join(tmpdir(), "timetree-to-ics-")), "calendar.ics");
		const { stderr, code } = await run("example_team", "-o", file);
		expect(code).toBe(0);
		expect(stderr).toContain("Example Team: 1 件");
		expect(readFileSync(file, "utf8")).toContain("SUMMARY:定例ミーティング");
	});

	test("書き込めない出力先は、理由を出して 1 で終わる", async () => {
		const { stderr, code } = await run("example_team", "-o", "/nonexistent-dir/calendar.ics");
		expect(code).toBe(1);
		expect(stderr).toContain("書き込めません");
	});

	test("引数が無い・多い・知らないオプションは、使い方を出して 2 で終わる", async () => {
		for (const args of [[], ["a", "b"], ["example_team", "--unknown"]]) {
			const { stderr, code } = await run(...args);
			expect(code).toBe(2);
			expect(stderr).toContain("使い方:");
		}
	});

	test("名前の形が違う・日数が数でない・範囲の外は、理由を出して 1 で終わる", async () => {
		const cases: [string[], string][] = [
			[["https://timetreeapp.com/calendars/abc"], "非公開"],
			[["example_team", "--past-days", "abc"], "--past-days"],
			[["example_team", "--future-days", "99999"], "futureDays"],
		];
		for (const [args, message] of cases) {
			const { stderr, code } = await run(...args);
			expect(code).toBe(1);
			expect(stderr).toContain(message);
		}
	});
});
