import { describe, expect, test } from "bun:test";
import { escapeText, fold, toIcs } from "../src/ics.ts";
import type { PublicEvent } from "../src/timetree.ts";
import { DAY, DEC_1 } from "./fixtures.ts";

function event(overrides: Partial<PublicEvent> = {}): PublicEvent {
	return {
		id: "100",
		title: "ワンマンライブ",
		note: "",
		allDay: false,
		startAt: DEC_1 + 9 * 60 * 60 * 1000,
		endAt: DEC_1 + 11 * 60 * 60 * 1000,
		locationName: "",
		locationAddress: "",
		linkUrl: "",
		url: "",
		recurrences: [],
		createdAt: DEC_1 - 30 * DAY,
		updatedAt: DEC_1 - 2 * DAY,
		...overrides,
	};
}

/** 折り返しを戻して行に分ける */
function unfold(ics: string): string[] {
	return ics.replace(/\r\n /g, "").split("\r\n");
}

describe("toIcs", () => {
	test("時刻つきの予定は UTC の時刻で出す", () => {
		const lines = unfold(toIcs([event()]));
		expect(lines).toContain("DTSTART:20261201T090000Z");
		expect(lines).toContain("DTEND:20261201T110000Z");
		expect(lines).toContain("UID:100@timetree-to-ics");
		expect(lines).toContain("DTSTAMP:20261129T000000Z");
	});

	test("終日の予定は、最後の日を含む TimeTree の終わりに 1 日足して DTEND にする", () => {
		// 12/1〜12/3 の 3 日間（TimeTree は最後の日の 0 時を返す）
		const lines = unfold(toIcs([event({ allDay: true, startAt: DEC_1, endAt: DEC_1 + 2 * DAY })]));
		expect(lines).toContain("DTSTART;VALUE=DATE:20261201");
		expect(lines).toContain("DTEND;VALUE=DATE:20261204");
	});

	test("本文・場所・リンクを入れ、無い欄の行は出さない", () => {
		const full = unfold(
			toIcs([
				event({
					note: "1 行目\n2 行目",
					locationName: "Example Hall",
					locationAddress: "東京都",
					url: "https://timetr.ee/p/example_band/100",
				}),
			]),
		);
		expect(full).toContain("DESCRIPTION:1 行目\\n2 行目\\n\\nhttps://timetr.ee/p/example_band/100");
		expect(full).toContain("LOCATION:Example Hall\\, 東京都");
		expect(full).toContain("URL:https://timetr.ee/p/example_band/100");

		const bare = unfold(toIcs([event()]));
		expect(bare.some((line) => line.startsWith("DESCRIPTION"))).toBe(false);
		expect(bare.some((line) => line.startsWith("LOCATION"))).toBe(false);
	});

	test("繰り返しの行は書いたまま渡し、形の分からない行は捨てる", () => {
		const lines = unfold(toIcs([event({ recurrences: ["RRULE:FREQ=WEEKLY;COUNT=3", "なにか"] })]));
		expect(lines).toContain("RRULE:FREQ=WEEKLY;COUNT=3");
		expect(lines).not.toContain("なにか");
	});

	test("繰り返しの時刻つきの予定は、予定の時間帯の時刻で出す（曜日が UTC でずれないように）", () => {
		// 日本時間 12/1（火）8:00 は、UTC では 11/30（月）23:00
		const lines = unfold(
			toIcs([
				event({
					startAt: DEC_1 - 60 * 60 * 1000,
					endAt: DEC_1 + 60 * 60 * 1000,
					timezone: "Asia/Tokyo",
					recurrences: ["RRULE:FREQ=WEEKLY;BYDAY=TU"],
				}),
			]),
		);
		expect(lines).toContain("DTSTART;TZID=Asia/Tokyo:20261201T080000");
		expect(lines).toContain("DTEND;TZID=Asia/Tokyo:20261201T100000");
	});

	test("繰り返しの無い予定と、時間帯が分からない予定は UTC で出す", () => {
		expect(unfold(toIcs([event({ timezone: "Asia/Tokyo" })]))).toContain("DTSTART:20261201T090000Z");
		for (const timezone of [undefined, "Not/AZone", "Asia/Tokyo\r\nX"]) {
			const lines = unfold(toIcs([event({ timezone, recurrences: ["RRULE:FREQ=WEEKLY"] })]));
			expect(lines).toContain("DTSTART:20261201T090000Z");
		}
	});

	test("カレンダーの名前と、空き時間を埋めない印を付ける", () => {
		const ics = toIcs([event()], { calendarName: "Example Band" });
		expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
		expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
		expect(unfold(ics)).toContain("X-WR-CALNAME:Example Band");
		expect(unfold(ics)).toContain("TRANSP:TRANSPARENT");
	});

	test("予定が 0 件でも、読めるカレンダーを返す", () => {
		const lines = unfold(toIcs([]));
		expect(lines[0]).toBe("BEGIN:VCALENDAR");
		expect(lines).not.toContain("BEGIN:VEVENT");
	});
});

describe("escapeText", () => {
	test("\\ ; , と改行（U+2028 も）をエスケープする", () => {
		expect(escapeText("a\\b;c,d\ne\u2028f")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
	});
});

describe("fold", () => {
	test("75 バイトを超える行を、字の途中で切らずに折る", () => {
		const line = `SUMMARY:${"あ".repeat(40)}`;
		const folded = fold(line);
		const encoder = new TextEncoder();
		for (const part of folded.split("\r\n")) {
			expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
		}
		expect(folded.replace(/\r\n /g, "")).toBe(line);
	});

	test("75 バイトまでの行は折らない", () => {
		const line = "X".repeat(75);
		expect(fold(line)).toBe(line);
	});
});
