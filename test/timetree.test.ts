import { describe, expect, test } from "bun:test";
import { fetchPublicCalendar, fetchPublicEvents, parseCalendarRef, TimeTreeError } from "../src/timetree.ts";
import { calendarBody, DEC_1, fakeFetch, rawEvent } from "./fixtures.ts";

const window = { from: new Date(0), to: new Date(1) };

describe("parseCalendarRef", () => {
	test("名前・Web 版の URL・アプリの共有で出る短い URL から、名前を取り出す", () => {
		expect(parseCalendarRef("example_team")).toBe("example_team");
		expect(parseCalendarRef("https://timetreeapp.com/public_calendars/example_team")).toBe("example_team");
		expect(parseCalendarRef("https://timetreeapp.com/public_calendars/example_team?tab=info")).toBe("example_team");
		expect(parseCalendarRef("https://timetr.ee/p/example_team")).toBe("example_team");
		expect(parseCalendarRef("https://timetr.ee/p/example_team/123456")).toBe("example_team");
	});

	test("名前に使えない字は受けない", () => {
		expect(() => parseCalendarRef("../etc")).toThrow(TypeError);
		expect(() => parseCalendarRef("")).toThrow(TypeError);
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

describe("fetchPublicCalendar", () => {
	test("名前と URL を返す", async () => {
		const { fetch } = fakeFetch((url) =>
			url.pathname === "/api/v2/public_calendars/example_team" ? { body: calendarBody } : undefined,
		);
		expect(await fetchPublicCalendar("example_team", { fetch })).toEqual({
			aliasCode: "example_team",
			name: "Example Team",
			url: "https://timetr.ee/p/example_team",
		});
	});
});

describe("fetchPublicEvents", () => {
	test("範囲を渡し、cursor で続きを読む", async () => {
		const { fetch, calls } = fakeFetch((url) => {
			if (!url.pathname.endsWith("/public_events")) return undefined;
			return url.searchParams.get("cursor") === "next-1"
				? { body: { public_events: [rawEvent({ id: 2 })], paging: { next: false, next_cursor: "end" } } }
				: { body: { public_events: [rawEvent({ id: 1 })], paging: { next: true, next_cursor: "next-1" } } };
		});
		const events = await fetchPublicEvents("example_team", { from: new Date(DEC_1), to: new Date(DEC_1 + 1), fetch });
		expect(events.map((e) => e.id)).toEqual(["1", "2"]);
		expect(calls[0]?.searchParams.get("from")).toBe(String(DEC_1));
		expect(calls[0]?.searchParams.get("utc_offset")).toBe("32400");
	});

	test("X-Timetreea と User-Agent のヘッダーを 2 つとも付ける（片方が欠けると、Cloudflare Workers からは 400 になる）", async () => {
		const { fetch, headers } = fakeFetch(() => ({ body: { public_events: [], paging: {} } }));
		await fetchPublicEvents("example_team", { ...window, fetch });
		expect(headers[0]?.["X-Timetreea"]).toBe("web/2.1.0/ja");
		expect(headers[0]?.["User-Agent"]).toStartWith("timetree-to-ics/");
	});

	test("欄の無い予定も、空の文字列と空の配列にそろえ、時間帯を読む", async () => {
		const { fetch } = fakeFetch(() => ({
			body: { public_events: [rawEvent({ note: undefined, recurrences: null, location_address: null })], paging: {} },
		}));
		const [event] = await fetchPublicEvents("example_team", { ...window, fetch });
		expect(event?.note).toBe("");
		expect(event?.recurrences).toEqual([]);
		expect(event?.locationAddress).toBe("");
		expect(event?.timezone).toBe("Asia/Tokyo");
	});

	test("中止の合図を fetch に渡す", async () => {
		const signals: (AbortSignal | undefined)[] = [];
		const controller = new AbortController();
		await fetchPublicEvents("example_team", {
			...window,
			signal: controller.signal,
			fetch: async (_url, init) => {
				signals.push(init?.signal);
				return new Response(JSON.stringify({ public_events: [], paging: {} }));
			},
		});
		expect(signals[0]).toBe(controller.signal);
	});

	test("無効な日付・逆の範囲は RangeError で、TimeTree に行かない", async () => {
		const { fetch, calls } = fakeFetch(() => ({ body: { public_events: [], paging: {} } }));
		await expect(fetchPublicEvents("example_team", { from: new Date("x"), to: new Date(1), fetch })).rejects.toThrow(RangeError);
		await expect(fetchPublicEvents("example_team", { from: new Date(2), to: new Date(1), fetch })).rejects.toThrow(RangeError);
		expect(calls).toEqual([]);
	});

	test("続きが上限（20 回）を超えたら、範囲を狭めるよう RangeError にする", async () => {
		const { fetch, calls } = fakeFetch(() => ({ body: { public_events: [], paging: { next: true, next_cursor: "more" } } }));
		await expect(fetchPublicEvents("example_team", { ...window, fetch })).rejects.toThrow(RangeError);
		expect(calls).toHaveLength(20);
	});
});

describe("TimeTreeError の種類", () => {
	test("届かないときは network で、元のエラーを cause に持つ", async () => {
		const cause = new Error("down");
		const error = await fetchPublicEvents("example_team", {
			...window,
			fetch: async () => {
				throw cause;
			},
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(TimeTreeError);
		expect((error as TimeTreeError).kind).toBe("network");
		expect((error as TimeTreeError).cause).toBe(cause);
	});

	test("エラーの番号は http で、status に入る（無い名前は 400、混み合うと 429）", async () => {
		for (const status of [400, 429]) {
			const { fetch } = fakeFetch(() => ({ status, body: {} }));
			const error = (await fetchPublicCalendar("example_team", { fetch }).catch((e: unknown) => e)) as TimeTreeError;
			expect(error).toBeInstanceOf(TimeTreeError);
			expect(error.kind).toBe("http");
			expect(error.status).toBe(status);
		}
	});

	test("返事の形が違う・null・予定の時刻が欠けているときは format", async () => {
		const bodies = [{ events: [] }, null, { public_events: [rawEvent({ start_at: undefined })], paging: {} }];
		for (const body of bodies) {
			const { fetch } = fakeFetch(() => ({ body }));
			const error = (await fetchPublicEvents("example_team", { ...window, fetch }).catch((e: unknown) => e)) as TimeTreeError;
			expect(error).toBeInstanceOf(TimeTreeError);
			expect(error.kind).toBe("format");
		}
	});
});
