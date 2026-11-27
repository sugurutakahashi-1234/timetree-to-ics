// 作った .ics を、本物の iCalendar の読み手（ical.js）で読み直し、形が正しいかを見る
import { expect, test } from "bun:test";
import ICAL from "ical.js";
import { toIcs } from "../src/ics.ts";
import type { PublicEvent } from "../src/timetree.ts";
import { DAY, DEC_1 } from "./fixtures.ts";

const base: PublicEvent = {
	id: "1", title: "", note: "", allDay: false, startAt: DEC_1, endAt: DEC_1 + 3600_000, locationName: "", locationAddress: "",
	linkUrl: "", url: "", recurrences: [], createdAt: DEC_1, updatedAt: DEC_1,
};

test("ical.js で読み直すと、書いた中身がそのまま戻る", () => {
	const longTitle = `定例ミーティング「${"あ".repeat(60)}」, 夜; 本社\\`;
	const events: PublicEvent[] = [
		{ ...base, id: "1", title: longTitle, note: "1 行目\n2 行目 3 行目", locationName: "Example Hall", url: "https://timetr.ee/p/example_team/1" },
		{ ...base, id: "2", title: "出張", allDay: true, startAt: DEC_1, endAt: DEC_1 + 2 * DAY },
		{ ...base, id: "3", title: "毎週", recurrences: ["RRULE:FREQ=WEEKLY;COUNT=3"] },
		{ ...base, id: "4", title: "毎週の朝", startAt: DEC_1 - 3600_000, timezone: "Asia/Tokyo", recurrences: ["RRULE:FREQ=WEEKLY;COUNT=3"] },
	];
	const calendar = new ICAL.Component(ICAL.parse(toIcs(events, { calendarName: "Example Team" })));
	expect(calendar.getFirstPropertyValue("x-wr-calname")).toBe("Example Team");

	const [timed, allDay, weekly, morning] = calendar.getAllSubcomponents("vevent").map((c) => new ICAL.Event(c));
	expect(timed?.uid).toBe("1@timetree-to-ics");
	expect(timed?.summary).toBe(longTitle);
	expect(timed?.description).toBe("1 行目\n2 行目\n3 行目\n\nhttps://timetr.ee/p/example_team/1");
	expect(timed?.location).toBe("Example Hall");
	expect(timed?.startDate.toJSDate().getTime()).toBe(DEC_1);
	expect(timed?.startDate.isDate).toBe(false);

	// 終日の 3 日間（12/1〜12/3）は、DTEND が 12/4（その日を含まない）
	expect(allDay?.startDate.isDate).toBe(true);
	expect(allDay?.startDate.toString()).toBe("2026-12-01");
	expect(allDay?.endDate.toString()).toBe("2026-12-04");

	expect(weekly?.isRecurring()).toBe(true);

	// 繰り返しの朝の予定は、日本時間の日付と時刻で読める（UTC の前の日にならない）
	expect(morning?.startDate.toString()).toBe("2026-12-01T08:00:00");
	expect(morning?.component.getFirstProperty("dtstart")?.getParameter("tzid")).toBe("Asia/Tokyo");
	// 付けた時間帯の定義で、UTC の時刻にも正しく戻せる
	const zones = calendar.getAllSubcomponents("vtimezone").map((c) => new ICAL.Timezone(c));
	expect(zones.map((z) => z.tzid)).toEqual(["Asia/Tokyo"]);
	const start = morning?.startDate.clone();
	if (start) start.zone = zones[0] as ICAL.Timezone;
	expect(start?.toJSDate().getTime()).toBe(DEC_1 - 3600_000);
	expect(calendar.getAllSubcomponents("vevent").every((c) => c.getFirstPropertyValue("transp") === "TRANSPARENT")).toBe(true);
});
