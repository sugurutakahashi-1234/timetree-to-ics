import { describe, expect, test } from "bun:test";
import { buildFeed } from "../src/feed.ts";
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
		if (url.pathname === "/api/v2/public_calendars/example_band") return { body: calendarBody };
		if (url.pathname.endsWith("/public_events")) return { body: { public_events: events, paging: {} } };
		return undefined;
	});
}

describe("buildFeed", () => {
	test("今日以降、1 年先までの予定を、始まりの順に載せる", async () => {
		const feed = await buildFeed("example_band", { now: NOW, fetch: routes().fetch });
		expect(feed.events.map((e) => e.title)).toEqual(["今日の終日", "来週"]);
		expect(feed.calendar.name).toBe("Example Band");
		expect(feed.ics).toContain("X-WR-CALNAME:Example Band");
	});

	test("pastDays で、過ぎた予定も載せる", async () => {
		const feed = await buildFeed("example_band", { now: NOW, pastDays: 2, fetch: routes().fetch });
		expect(feed.events.map((e) => e.title)).toEqual(["昨日", "今日の終日", "来週"]);
	});

	test("TimeTree には 1 日広い範囲を頼む", async () => {
		const { fetch, calls } = routes();
		await buildFeed("example_band", { now: NOW, fetch });
		const eventsCall = calls.find((url) => url.pathname.endsWith("/public_events"));
		expect(eventsCall?.searchParams.get("from")).toBe(String(NOW.getTime() - DAY));
	});

	test("負の日数は受けない", async () => {
		await expect(buildFeed("example_band", { pastDays: -1, fetch: routes().fetch })).rejects.toThrow(RangeError);
	});
});
