// 公開カレンダーを読んで、今後の予定だけの .ics を 1 回で作る。

import { type IcsOptions, toIcs } from "./ics.ts";
import { type FetchLike, fetchPublicCalendar, fetchPublicEvents, type PublicCalendar, type PublicEvent } from "./timetree.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 3650;

/** {@link timetreeToIcs} のオプション */
export type ConvertOptions = {
	/** 今より何日前までに終わった予定も含めるか。既定は 0（今より後に終わる予定だけ） */
	pastDays?: number | undefined;
	/** 今から何日先までに始まる予定を含めるか。既定は 365 */
	futureDays?: number | undefined;
	/** 「今」とみなす時刻。既定は呼んだ時刻（テストや、基準をずらしたいときに渡す） */
	now?: Date | undefined;
	/** .ics に含める予定を、さらに絞る（例: `(e) => !e.allDay`） */
	filter?: ((event: PublicEvent) => boolean) | undefined;
	/** .ics の作り方（カレンダーの表示名の上書き・再取得の間隔）。表示名の既定は TimeTree のカレンダー名 */
	ics?: IcsOptions | undefined;
	/** 読むのを途中でやめるとき */
	signal?: AbortSignal | undefined;
	fetch?: FetchLike | undefined;
};

/** {@link timetreeToIcs} の結果 */
export type ConvertResult = {
	/** .ics の内容（CRLF の改行） */
	ics: string;
	calendar: PublicCalendar;
	/** .ics に含めた予定（開始時刻の順） */
	events: PublicEvent[];
};

/**
 * TimeTree の公開カレンダーを、今後の予定だけの .ics にする。
 * 含めるのは、今より後に終わり（繰り返しの予定は、UNTIL で終わっていない物）、futureDays 日先までに始まる予定。
 * @param calendar 公開カレンダーの名前か URL（`example_band`・`https://timetreeapp.com/public_calendars/example_band`・`https://timetr.ee/p/example_band`）
 * @throws {TypeError} 名前か URL の形が違うとき
 * @throws {RangeError} 日数が 0〜3650 の範囲にないとき、now が無効な日付のとき
 * @throws {TimeTreeError} TimeTree を読めなかったとき（空の .ics は返さない）
 * @example
 * const { ics } = await timetreeToIcs("https://timetr.ee/p/example_band");
 * return new Response(ics, { headers: { "content-type": ICS_CONTENT_TYPE } });
 */
export async function timetreeToIcs(calendar: string, options: ConvertOptions = {}): Promise<ConvertResult> {
	const pastDays = days(options.pastDays ?? 0, "pastDays");
	const futureDays = days(options.futureDays ?? 365, "futureDays");
	const now = (options.now ?? new Date()).getTime();
	if (!Number.isFinite(now)) {
		throw new RangeError("now は有効な日付にしてください");
	}
	const from = now - pastDays * DAY_MS;
	const to = now + futureDays * DAY_MS;

	const [meta, fetched] = await Promise.all([
		fetchPublicCalendar(calendar, { fetch: options.fetch, signal: options.signal }),
		// TimeTree の範囲の扱いが分からないので 1 日広く読み、下で絞る
		fetchPublicEvents(calendar, { from: new Date(from - DAY_MS), to: new Date(to), fetch: options.fetch, signal: options.signal }),
	]);

	const events = fetched
		.filter((event) => (event.recurrences.length > 0 ? !endedBefore(event, from) : endOf(event) > from) && event.startAt <= to)
		.filter((event) => options.filter?.(event) ?? true)
		.sort((a, b) => a.startAt - b.startAt || a.id.localeCompare(b.id));

	return { ics: toIcs(events, { calendarName: meta.name, ...options.ics }), calendar: meta, events };
}

// 終日の予定の endAt は最終日の 0 時なので、その日の終わりまでを予定の中と見る
function endOf(event: PublicEvent): number {
	return event.allDay ? event.endAt + DAY_MS : event.endAt;
}

// 繰り返しの予定は、RRULE の UNTIL が from より前なら、もう起きないので落とす。
// COUNT で終わる繰り返しは、最後の回を数えないと分からないので残す
function endedBefore(event: PublicEvent, from: number): boolean {
	const matches = event.recurrences
		.filter((line) => line.startsWith("RRULE"))
		.map((line) => /[;:]UNTIL=(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?/.exec(line));
	if (matches.length === 0) return false;
	let last = Number.NEGATIVE_INFINITY;
	for (const match of matches) {
		if (!match) return false;
		const [, y, mo, d, h = "23", mi = "59", s = "59"] = match;
		last = Math.max(last, Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
	}
	// UNTIL は最後の回の始まり。その回の長さの分だけ後ろまでは、まだ終わっていない
	return last + (endOf(event) - event.startAt) < from;
}

function days(value: number, name: string): number {
	if (!Number.isFinite(value) || value < 0 || value > MAX_DAYS) {
		throw new RangeError(`${name} は 0〜${MAX_DAYS} の数にしてください: ${value}`);
	}
	return value;
}
