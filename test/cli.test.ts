// コマンドの引数と終了コード。TimeTree に行かない入力の誤りだけを見る（読めるかは週 1 回の live.yml が見る）
import { describe, expect, test } from "bun:test";

async function run(...args: string[]) {
	const proc = Bun.spawn(["bun", "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
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

	test("引数が無い・多い・知らないオプションは、使い方を出して 2 で終わる", async () => {
		for (const args of [[], ["a", "b"], ["example_band", "--unknown"]]) {
			const { stderr, code } = await run(...args);
			expect(code).toBe(2);
			expect(stderr).toContain("使い方:");
		}
	});

	test("名前の形が違う・日数が数でない・範囲の外は、理由を出して 1 で終わる", async () => {
		const cases: [string[], string][] = [
			[["https://timetreeapp.com/calendars/abc"], "非公開"],
			[["example_band", "--past-days", "abc"], "--past-days"],
			[["example_band", "--future-days", "99999"], "futureDays"],
		];
		for (const [args, message] of cases) {
			const { stderr, code } = await run(...args);
			expect(code).toBe(1);
			expect(stderr).toContain(message);
		}
	});
});
