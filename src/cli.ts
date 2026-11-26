#!/usr/bin/env node
// TimeTree の公開カレンダーを、今後の予定だけの .ics にして出すコマンド。

import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { timetreeToIcs } from "./convert.ts";
import { TimeTreeError } from "./timetree.ts";

const usage = `使い方: timetree-to-ics <公開カレンダーの名前か URL> [オプション]

TimeTree の公開カレンダーを読み、今後の予定を iCalendar（.ics）にして出す。

オプション:
  -o, --output <ファイル>   書き出す先。省くと標準出力
      --past-days <日数>    今日より前を何日ぶん載せるか（既定 0）
      --future-days <日数>  今日から何日先まで載せるか（既定 365）
  -h, --help                この説明

例:
  npx timetree-to-ics https://timetreeapp.com/public_calendars/<名前> -o calendar.ics`;

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
			await writeFile(values.output, result.ics);
			console.error(`${result.calendar.name}: ${result.events.length} 件を ${values.output} に書いた`);
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
			help: { type: "boolean", short: "h" },
		},
	});
}

function toNumber(value: string | undefined, name: string): number | undefined {
	if (value === undefined) return undefined;
	const n = Number(value);
	if (!Number.isFinite(n)) throw new RangeError(`${name} には数を渡す: ${value}`);
	return n;
}

process.exitCode = await main();
