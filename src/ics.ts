// 予定を iCalendar（RFC 5545）の .ics にする。
// Google カレンダー・Apple のカレンダー・Outlook の URL での購読に通る形だけを出す。

import type { PublicEvent } from "./timetree.ts";

/** .ics を返すときの Content-Type。`new Response(ics, { headers: { "content-type": ICS_CONTENT_TYPE } })` */
export const ICS_CONTENT_TYPE = "text/calendar; charset=utf-8";

/** {@link toIcs} のオプション */
export type IcsOptions = {
	/** カレンダーの名前（X-WR-CALNAME）。購読したときの最初の表示名になる */
	calendarName?: string | undefined;
	/** 再取得の間隔の目安（ISO 8601 の期間。例 `PT6H`）。Apple・Outlook は従い、Google は従わない。既定は `PT6H` */
	refreshInterval?: string | undefined;
};

const DURATION = /^P(?=\d|T\d)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 予定の配列を .ics の文字列にする（CRLF の改行・75 バイトで折り返し）。
 * 予定を絞りたいときは、絞った配列を渡す: `toIcs(events.filter((e) => !e.allDay), { calendarName })`
 * @throws {RangeError} refreshInterval が ISO 8601 の期間でないとき
 */
export function toIcs(events: readonly PublicEvent[], options: IcsOptions = {}): string {
	const refresh = options.refreshInterval ?? "PT6H";
	if (!DURATION.test(refresh)) {
		throw new RangeError(`refreshInterval は ISO 8601 の期間（例 PT6H）にしてください: ${refresh}`);
	}
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//timetree-to-ics//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		...(options.calendarName ? [`X-WR-CALNAME:${escapeText(options.calendarName)}`] : []),
		`REFRESH-INTERVAL;VALUE=DURATION:${refresh}`,
		`X-PUBLISHED-TTL:${refresh}`,
		...events.flatMap(eventLines),
		"END:VCALENDAR",
	];
	return `${lines.map(fold).join("\r\n")}\r\n`;
}

function eventLines(event: PublicEvent): string[] {
	const location = [event.locationName, event.locationAddress].filter(Boolean).join(", ");
	const description = [event.note, event.linkUrl, event.url].filter(Boolean).join("\n\n");
	return [
		"BEGIN:VEVENT",
		// TimeTree の予定の ID は変わらないので、同じ予定は購読の側でも同じ予定として上書きされる
		`UID:${event.id}@timetree-to-ics`,
		`DTSTAMP:${utcDateTime(event.updatedAt)}`,
		`CREATED:${utcDateTime(event.createdAt)}`,
		`LAST-MODIFIED:${utcDateTime(event.updatedAt)}`,
		...(event.allDay
			? [
					`DTSTART;VALUE=DATE:${utcDate(event.startAt)}`,
					// TimeTree の終わりは最後の日を含み、iCalendar の DTEND は含まないので 1 日足す
					`DTEND;VALUE=DATE:${utcDate(event.endAt + DAY_MS)}`,
				]
			: timedLines(event)),
		`SUMMARY:${escapeText(event.title)}`,
		...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
		...(location ? [`LOCATION:${escapeText(location)}`] : []),
		// URL と繰り返しの行はエスケープせずに書くので、改行を含む物は捨てる（任意の行を差し込ませない）
		...(event.url && !/[\r\n]/.test(event.url) ? [`URL:${event.url}`] : []),
		// 繰り返しの行は TimeTree の書いたまま渡す。形の分からない行は捨てる
		...event.recurrences.filter((line) => /^(RRULE|EXRULE|RDATE|EXDATE)[:;]/.test(line) && !/[\r\n]/.test(line)),
		// 人の予定なので、購読した人の空き時間を埋めない
		"TRANSP:TRANSPARENT",
		"END:VEVENT",
	];
}

/** RFC 5545 の TEXT の書き方（\ ; , と改行をエスケープする）。TimeTree の本文に入る U+2028 も改行にする */
export function escapeText(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r\n|\r|\n|\u2028|\u2029/g, "\\n");
}

const encoder = new TextEncoder();

/** 1 行を 75 バイトで折る（RFC 5545 3.1）。日本語の字の途中では切らない */
export function fold(line: string): string {
	let out = "";
	let width = 0;
	for (const char of line) {
		const bytes = encoder.encode(char).length;
		if (width + bytes > 75) {
			out += "\r\n ";
			width = 1;
		}
		out += char;
		width += bytes;
	}
	return out;
}

// 時刻つきの予定は UTC で書く。ただし繰り返しの予定は、予定の時間帯の時刻で書く。
// UTC で書くと、繰り返しの曜日と日付が UTC で数えられ、日本時間の 0〜9 時の予定が前の日にずれるため。
// VTIMEZONE は付けず、IANA の名前だけを書く（Google・Apple・Outlook はこの名前で読む）
function timedLines(event: PublicEvent): string[] {
	const zone = event.recurrences.length > 0 ? validZone(event.timezone) : undefined;
	if (!zone) return [`DTSTART:${utcDateTime(event.startAt)}`, `DTEND:${utcDateTime(event.endAt)}`];
	return [
		`DTSTART;TZID=${zone}:${localDateTime(event.startAt, zone)}`,
		`DTEND;TZID=${zone}:${localDateTime(event.endAt, zone)}`,
	];
}

function validZone(zone: string | undefined): string | undefined {
	if (!zone || zone === "UTC" || !/^[A-Za-z0-9_+/-]{1,64}$/.test(zone)) return undefined;
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: zone });
		return zone;
	} catch {
		return undefined;
	}
}

function localDateTime(ms: number, zone: string): string {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-US", {
			timeZone: zone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		})
			.formatToParts(new Date(ms))
			.map((part) => [part.type, part.value]),
	);
	return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

function utcDateTime(ms: number): string {
	return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function utcDate(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
}
