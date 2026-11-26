#!/usr/bin/env node
// TimeTree の公開カレンダーを、今後の予定だけの .ics にして出すコマンド。

import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { timetreeToIcs } from "./convert.ts";
import { TimeTreeError, VERSION } from "./timetree.ts";

const usage = `使い方: timetree-to-ics <公開カレンダーの名前か URL> [オプション]

TimeTree の公開カレンダーを読み、今後の予定を iCalendar（.ics）にして出力します。
名前か URL は、名前・https://timetreeapp.com/public_calendars/<名前>・アプリの共有で出る https://timetr.ee/p/<名前> のどれでも受け付けます。

オプション:
  -o, --output <ファイル>   出力先のファイル。省略すると標準出力
      --past-days <日数>    今より何日前までに終わった予定も含めるか（デフォルト 0）
      --future-days <日数>  今から何日先までに始まる予定を含めるか（デフォルト 365）
  -v, --version             版を表示
  -h, --help                この説明を表示

終了コード: 0 = 成功、1 = TimeTree を読めなかった・入力が正しくない・書き込めなかった、2 = 使い方の誤り

例:
  npx timetree-to-ics https://timetr.ee/p/<名前> -o calendar.ics`;

async function main(): Promise<number> {
	let parsed: ReturnType<typeof parse>;
	try {
		parsed = parse();
	} catch (error) {
		console.error(`${error instanceof Error ? error.message : String(error)}\n\n${usage}`);
		return 2;
	}
	const { values, positionals } = parsed;
	if (values.help) {
		console.log(usage);
		return 0;
	}
	if (values.version) {
		console.log(VERSION);
		return 0;
	}
	if (positionals.length !== 1) {
		console.error(usage);
		return 2;
	}

	try {
		const result = await timetreeToIcs(positionals[0] ?? "", {
			pastDays: toNumber(values["past-days"], "--past-days"),
			futureDays: toNumber(values["future-days"], "--future-days"),
		});
		if (values.output) {
			try {
				await writeFile(values.output, result.ics);
			} catch (error) {
				const code = (error as NodeJS.ErrnoException).code;
				console.error(`${values.output} に書き込めません${code ? `（${code}）` : ""}`);
				return 1;
			}
			console.error(`${result.calendar.name}: ${result.events.length} 件を ${values.output} に書き出しました`);
		} else {
			process.stdout.write(result.ics);
		}
		return 0;
	} catch (error) {
		if (error instanceof TimeTreeError || error instanceof TypeError || error instanceof RangeError) {
			console.error(error.message);
			return 1;
		}
		throw error;
	}
}

function parse() {
	return parseArgs({
		allowPositionals: true,
		options: {
			output: { type: "string", short: "o" },
			"past-days": { type: "string" },
			"future-days": { type: "string" },
			version: { type: "boolean", short: "v" },
			help: { type: "boolean", short: "h" },
		},
	});
}

function toNumber(value: string | undefined, name: string): number | undefined {
	if (value === undefined) return undefined;
	const n = Number(value);
	if (!Number.isFinite(n)) throw new RangeError(`${name} には数を渡してください: ${value}`);
	return n;
}

process.exitCode = await main();
