import { describe, expect, test } from "bun:test";
import { fetchPublicCalendar, fetchPublicEvents, parseCalendarRef, TimeTreeError } from "../src/timetree.ts";
import { calendarBody, DEC_1, fakeFetch, rawEvent } from "./fixtures.ts";

describe("parseCalendarRef", () => {
	test("名前と URL のどちらからも名前を取り出す", () => {
		expect(parseCalendarRef("example_band")).toBe("example_band");
		expect(parseCalendarRef("https://timetreeapp.com/public_calendars/example_band")).toBe("example_band");
		expect(parseCalendarRef("https://timetreeapp.com/public_calendars/example_band?tab=info")).toBe("example_band");
	});

	test("名前に使えない字は受けない", () => {
		expect(() => parseCalendarRef("../etc")).toThrow(TypeError);
		expect(() => parseCalendarRef("")).toThrow(TypeError);
	});
});

describe("fetchPublicCalendar", () => {
	test("名前と URL を返す", async () => {
		const { fetch } = fakeFetch((url) =>
			url.pathname === "/api/v2/public_calendars/example_band" ? { body: calendarBody } : undefined,
		);
		expect(await fetchPublicCalendar("example_band", { fetch })).toEqual({
			aliasCode: "example_band",
			name: "Example Band",
			url: "https://timetr.ee/p/example_band",
		});
	});

	test("無い名前（400）は TimeTreeError にする", async () => {
		const { fetch } = fakeFetch(() => ({ status: 400, body: {} }));
		const error = await fetchPublicCalendar("no_such", { fetch }).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(TimeTreeError);
		expect((error as TimeTreeError).status).toBe(400);
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
		const events = await fetchPublicEvents("example_band", { from: new Date(DEC_1), to: new Date(DEC_1 + 1), fetch });
		expect(events.map((e) => e.id)).toEqual(["1", "2"]);
		expect(calls[0]?.searchParams.get("from")).toBe(String(DEC_1));
		expect(calls[0]?.searchParams.get("utc_offset")).toBe("32400");
	});

	test("名乗りを 2 つとも付ける（片方が欠けると、Cloudflare Workers からは 400 になる）", async () => {
		const { fetch, headers } = fakeFetch(() => ({ body: { public_events: [], paging: {} } }));
		await fetchPublicEvents("example_band", { from: new Date(0), to: new Date(1), fetch });
		expect(headers[0]?.["X-Timetreea"]).toBe("web/2.1.0/ja");
		expect(headers[0]?.["User-Agent"]).toStartWith("timetree-to-ics/");
	});

	test("欄の無い予定も、空の文字列と空の配列にそろえる", async () => {
		const { fetch } = fakeFetch(() => ({
			body: { public_events: [rawEvent({ note: undefined, recurrences: null, location_address: null })], paging: {} },
		}));
		const [event] = await fetchPublicEvents("example_band", { from: new Date(0), to: new Date(1), fetch });
		expect(event?.note).toBe("");
		expect(event?.recurrences).toEqual([]);
		expect(event?.locationAddress).toBe("");
	});

	test("返事の形が違えば TimeTreeError にする", async () => {
		const { fetch } = fakeFetch(() => ({ body: { events: [] } }));
		await expect(fetchPublicEvents("example_band", { from: new Date(0), to: new Date(1), fetch })).rejects.toThrow(
			TimeTreeError,
		);
	});

	test("届かないときも TimeTreeError にする", async () => {
		const fetch = async () => {
			throw new Error("network down");
		};
		await expect(fetchPublicEvents("example_band", { from: new Date(0), to: new Date(1), fetch })).rejects.toThrow(
			TimeTreeError,
		);
	});
});
