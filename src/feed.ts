// 公開カレンダーを読んで、今後の予定だけの .ics を 1 回で作る。

import { toIcs } from "./ics.ts";
import { type FetchLike, fetchPublicCalendar, fetchPublicEvents, type PublicCalendar, type PublicEvent } from "./timetree.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

export type FeedOptions = {
	/** 今日より前を何日ぶん載せるか。既定は 0（今日以降だけ） */
	pastDays?: number;
	/** 今日から何日先まで載せるか。既定は 365 */
	futureDays?: number;
	/** 時刻の基準。テスト用 */
	now?: Date;
	fetch?: FetchLike;
};

export type Feed = {
	ics: string;
	calendar: PublicCalendar;
	events: PublicEvent[];
};

export async function buildFeed(alias: string, options: FeedOptions = {}): Promise<Feed> {
	const pastDays = nonNegative(options.pastDays ?? 0, "pastDays");
	const futureDays = nonNegative(options.futureDays ?? 365, "futureDays");
	const now = (options.now ?? new Date()).getTime();
	const from = now - pastDays * DAY_MS;
	const to = now + futureDays * DAY_MS;

	const [calendar, fetched] = await Promise.all([
		fetchPublicCalendar(alias, { fetch: options.fetch }),
		// TimeTree の範囲の扱いが分からないので 1 日広く読み、下で絞る
		fetchPublicEvents(alias, { from: new Date(from - DAY_MS), to: new Date(to), fetch: options.fetch }),
	]);

	const events = fetched
		.filter((event) => endOf(event) > from && event.startAt <= to)
		.sort((a, b) => a.startAt - b.startAt || a.id.localeCompare(b.id));

	return { ics: toIcs(events, { calendarName: calendar.name }), calendar, events };
}

// 終日の予定の endAt は最後の日の 0 時なので、その日の終わりまでを予定の中と見る
function endOf(event: PublicEvent): number {
	return event.allDay ? event.endAt + DAY_MS : event.endAt;
}

function nonNegative(value: number, name: string): number {
	if (!Number.isFinite(value) || value < 0) {
		throw new RangeError(`${name} は 0 以上の数にする: ${value}`);
	}
	return value;
}
