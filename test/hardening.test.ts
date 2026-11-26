// 1.1.0 で直した振る舞い（短い URL・エラーの種類・入力の検査・繰り返し・差し込みの防ぎ）を守る
import { describe, expect, test } from "bun:test";
import { timetreeToIcs } from "../src/convert.ts";
import { ICS_CONTENT_TYPE, toIcs } from "../src/ics.ts";
import { fetchPublicEvents, parseCalendarRef, TimeTreeError } from "../src/timetree.ts";
import { calendarBody, DAY, DEC_1, fakeFetch, rawEvent } from "./fixtures.ts";

const NOW = new Date(DEC_1 + 12 * 60 * 60 * 1000);

function routes(events: unknown[]) {
	return fakeFetch((url) => {
		if (url.pathname === "/api/v2/public_calendars/example_band") return { body: calendarBody };
		if (url.pathname.endsWith("/public_events")) return { body: { public_events: events, paging: {} } };
		return undefined;
	});
}

describe("parseCalendarRef", () => {
	test("アプリの共有で出る短い URL と、予定の URL も受ける", () => {
		expect(parseCalendarRef("https://timetr.ee/p/example_band")).toBe("example_band");
		expect(parseCalendarRef("https://timetr.ee/p/example_band/123456")).toBe("example_band");
	});

	test("非公開のカレンダーの URL は、入力を文に含めずに TypeError にする", () => {
		const secret = "https://timetreeapp.com/calendars/SECRET_TOKEN";
		expect(() => parseCalendarRef(secret)).toThrow(TypeError);
		try {
			parseCalendarRef(secret);
		} catch (error) {
			expect((error as Error).message).not.toContain("SECRET_TOKEN");
			expect((error as Error).message).toContain("非公開");
		}
	});
});

describe("TimeTreeError の種類", () => {
	const window = { from: new Date(0), to: new Date(1) };

	test("届かないときは network で、元のエラーを cause に持つ", async () => {
		const cause = new Error("down");
		const error = await fetchPublicEvents("example_band", {
			...window,
			fetch: async () => {
				throw cause;
			},
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(TimeTreeError);
		expect((error as TimeTreeError).kind).toBe("network");
		expect((error as TimeTreeError).cause).toBe(cause);
	});

	test("エラーの番号は http で、status に入る", async () => {
		const { fetch } = fakeFetch(() => ({ status: 429, body: {} }));
		const error = (await fetchPublicEvents("example_band", { ...window, fetch }).catch((e: unknown) => e)) as TimeTreeError;
		expect(error.kind).toBe("http");
		expect(error.status).toBe(429);
	});

	test("返事が null・予定の時刻が欠けているときは format", async () => {
		const nullBody = fakeFetch(() => ({ body: null }));
		expect(((await fetchPublicEvents("example_band", { ...window, fetch: nullBody.fetch }).catch((e: unknown) => e)) as TimeTreeError).kind).toBe("format");
		const missing = routes([rawEvent({ start_at: undefined })]);
		expect(((await fetchPublicEvents("example_band", { ...window, fetch: missing.fetch }).catch((e: unknown) => e)) as TimeTreeError).kind).toBe("format");
	});
});

describe("入力の検査", () => {
	test("無効な日付・逆の範囲は RangeError で、TimeTree に行かない", async () => {
		const { fetch, calls } = routes([]);
		await expect(fetchPublicEvents("example_band", { from: new Date("x"), to: new Date(1), fetch })).rejects.toThrow(RangeError);
		await expect(fetchPublicEvents("example_band", { from: new Date(2), to: new Date(1), fetch })).rejects.toThrow(RangeError);
		await expect(timetreeToIcs("example_band", { futureDays: 1e9, fetch })).rejects.toThrow(RangeError);
		await expect(timetreeToIcs("example_band", { now: new Date("x"), fetch })).rejects.toThrow(RangeError);
		expect(calls).toEqual([]);
	});

	test("中止の合図を fetch に渡す", async () => {
		const signals: (AbortSignal | undefined)[] = [];
		const controller = new AbortController();
		await fetchPublicEvents("example_band", {
			from: new Date(0),
			to: new Date(1),
			signal: controller.signal,
			fetch: async (_url, init) => {
				signals.push(init?.signal);
				return new Response(JSON.stringify({ public_events: [], paging: {} }));
			},
		});
		expect(signals[0]).toBe(controller.signal);
	});
});

describe("timetreeToIcs のオプション", () => {
	test("初回が過去でも、繰り返しの予定は残す", async () => {
		const weekly = rawEvent({ id: 9, title: "毎週", start_at: DEC_1 - 30 * DAY, end_at: DEC_1 - 30 * DAY + 3600_000, recurrences: ["RRULE:FREQ=WEEKLY"] });
		const result = await timetreeToIcs("example_band", { now: NOW, fetch: routes([weekly]).fetch });
		expect(result.events.map((e) => e.title)).toEqual(["毎週"]);
	});

	test("filter で絞り、ics で表示名を上書きできる", async () => {
		const events = [
			rawEvent({ id: 1, title: "終日", all_day: true, start_at: DEC_1 + DAY, end_at: DEC_1 + DAY }),
			rawEvent({ id: 2, title: "時刻つき", start_at: DEC_1 + DAY, end_at: DEC_1 + DAY + 3600_000 }),
		];
		const result = await timetreeToIcs("example_band", {
			now: NOW,
			fetch: routes(events).fetch,
			filter: (e) => !e.allDay,
			ics: { calendarName: "上書き" },
		});
		expect(result.events.map((e) => e.title)).toEqual(["時刻つき"]);
		expect(result.ics).toContain("X-WR-CALNAME:上書き");
	});
});

describe("toIcs の守り", () => {
	const event = {
		id: "1", title: "t", note: "", allDay: false, startAt: DEC_1, endAt: DEC_1 + 1, locationName: "", locationAddress: "",
		linkUrl: "", url: "https://example.com/x\r\nATTENDEE:mailto:evil@example.com", recurrences: ["RRULE:FREQ=DAILY\r\nX-EVIL:1"],
		createdAt: DEC_1, updatedAt: DEC_1,
	};

	test("改行を含む URL と繰り返しの行は書かない", () => {
		const lines = toIcs([event]).replace(/\r\n /g, "").split("\r\n");
		// 本文（DESCRIPTION）には改行をエスケープした形で残ってよいが、行として差し込まれてはいけない
		expect(lines.filter((line) => /^(ATTENDEE|X-EVIL|URL)[:;]/.test(line))).toEqual([]);
		expect(lines.some((line) => line.startsWith("RRULE"))).toBe(false);
	});

	test("再取得の間隔が ISO 8601 の期間でなければ RangeError", () => {
		expect(() => toIcs([], { refreshInterval: "6h" })).toThrow(RangeError);
		expect(() => toIcs([], { refreshInterval: "P1D" })).not.toThrow();
	});

	test("Content-Type の定数", () => {
		expect(ICS_CONTENT_TYPE).toBe("text/calendar; charset=utf-8");
	});
});
