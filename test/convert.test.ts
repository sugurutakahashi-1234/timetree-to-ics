import { describe, expect, test } from "bun:test";
import { timetreeToIcs } from "../src/convert.ts";
import { calendarBody, DAY, DEC_1, fakeFetch, rawEvent } from "./fixtures.ts";

// 12/1 の日本時間の夜（UTC の 12:00）に作る
const NOW = new Date(DEC_1 + 12 * 60 * 60 * 1000);

const events = [
	// 昨日で終わった時刻つきの予定
	rawEvent({ id: 1, title: "昨日", start_at: DEC_1 - DAY + 9 * 3600_000, end_at: DEC_1 - DAY + 11 * 3600_000 }),
	// 今日の終日の予定（endAt は今日の 0 時で、今より前）
	rawEvent({ id: 2, title: "今日の終日", all_day: true, start_at: DEC_1, end_at: DEC_1 }),
	// 来週の予定
	rawEvent({ id: 3, title: "来週", start_at: DEC_1 + 7 * DAY, end_at: DEC_1 + 7 * DAY + 3600_000 }),
	// 2 年先の予定
	rawEvent({ id: 4, title: "2 年先", start_at: DEC_1 + 800 * DAY, end_at: DEC_1 + 800 * DAY + 3600_000 }),
];

function routes() {
	return fakeFetch((url) => {
		if (url.pathname === "/api/v2/public_calendars/example_team") return { body: calendarBody };
		if (url.pathname.endsWith("/public_events")) return { body: { public_events: events, paging: {} } };
		return undefined;
	});
}

describe("timetreeToIcs", () => {
	test("今日以降、1 年先までの予定を、始まりの順に載せる", async () => {
		const result = await timetreeToIcs("example_team", { now: NOW, fetch: routes().fetch });
		expect(result.events.map((e) => e.title)).toEqual(["今日の終日", "来週"]);
		expect(result.calendar.name).toBe("Example Team");
		expect(result.ics).toContain("X-WR-CALNAME:Example Team");
	});

	test("pastDays で、過ぎた予定も載せる", async () => {
		const result = await timetreeToIcs("example_team", { now: NOW, pastDays: 2, fetch: routes().fetch });
		expect(result.events.map((e) => e.title)).toEqual(["昨日", "今日の終日", "来週"]);
	});

	test("TimeTree には 1 日広い範囲を頼む", async () => {
		const { fetch, calls } = routes();
		await timetreeToIcs("example_team", { now: NOW, fetch });
		const eventsCall = calls.find((url) => url.pathname.endsWith("/public_events"));
		expect(eventsCall?.searchParams.get("from")).toBe(String(NOW.getTime() - DAY));
	});

	test("繰り返しの予定は、UNTIL で終わった物だけを落とす", async () => {
		const start = DEC_1 - 100 * DAY;
		const repeating = [
			rawEvent({ id: 11, title: "先月で終わった", start_at: start, end_at: start + 3600_000, recurrences: ["RRULE:FREQ=WEEKLY;UNTIL=20261101T000000Z"] }),
			rawEvent({ id: 12, title: "来月まで続く", start_at: start, end_at: start + 3600_000, recurrences: ["RRULE:FREQ=WEEKLY;UNTIL=20270101T000000Z"] }),
			rawEvent({ id: 13, title: "回数で終わる", start_at: start, end_at: start + 3600_000, recurrences: ["RRULE:FREQ=WEEKLY;COUNT=3"] }),
			rawEvent({ id: 14, title: "日付だけの UNTIL", start_at: start, end_at: start + 3600_000, recurrences: ["RRULE:FREQ=DAILY;UNTIL=20261201"] }),
		];
		const { fetch } = fakeFetch((url) => {
			if (url.pathname === "/api/v2/public_calendars/example_team") return { body: calendarBody };
			return { body: { public_events: repeating, paging: {} } };
		});
		const result = await timetreeToIcs("example_team", { now: NOW, fetch });
		expect(result.events.map((e) => e.title)).toEqual(["来月まで続く", "回数で終わる", "日付だけの UNTIL"]);
	});

	test("初回が過去でも、繰り返しの予定は残す", async () => {
		const weekly = rawEvent({ id: 9, title: "毎週", start_at: DEC_1 - 30 * DAY, end_at: DEC_1 - 30 * DAY + 3600_000, recurrences: ["RRULE:FREQ=WEEKLY"] });
		const { fetch } = fakeFetch((url) =>
			url.pathname.endsWith("/public_events") ? { body: { public_events: [weekly], paging: {} } } : { body: calendarBody },
		);
		const result = await timetreeToIcs("example_team", { now: NOW, fetch });
		expect(result.events.map((e) => e.title)).toEqual(["毎週"]);
	});

	test("filter で絞り、ics で表示名を上書きできる", async () => {
		const result = await timetreeToIcs("example_team", {
			now: NOW,
			fetch: routes().fetch,
			filter: (e) => !e.allDay,
			ics: { calendarName: "上書き" },
		});
		expect(result.events.map((e) => e.title)).toEqual(["来週"]);
		expect(result.ics).toContain("X-WR-CALNAME:上書き");
	});

	test("負の日数・大きすぎる日数・無効な now は RangeError で、TimeTree に行かない", async () => {
		const { fetch, calls } = routes();
		await expect(timetreeToIcs("example_team", { pastDays: -1, fetch })).rejects.toThrow(RangeError);
		await expect(timetreeToIcs("example_team", { futureDays: 1e9, fetch })).rejects.toThrow(RangeError);
		await expect(timetreeToIcs("example_team", { now: new Date("x"), fetch })).rejects.toThrow(RangeError);
		expect(calls).toEqual([]);
	});
});
