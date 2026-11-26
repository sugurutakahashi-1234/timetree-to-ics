// TimeTree の公開の口の返事を写した見本。中身は作り物（実在のカレンダーの名前や予定を入れない）。
// 欄の並びと値の形は、2026-11 に実物から読んだ物に合わせてある。

import type { FetchLike } from "../src/timetree.ts";

export const DAY = 24 * 60 * 60 * 1000;

// 2026-12-01T00:00:00Z
export const DEC_1 = Date.UTC(2026, 11, 1);

export const calendarBody = {
	public_calendar: {
		id: 1,
		alias_code: "example_band",
		name: "Example Band",
		url: "https://timetr.ee/p/example_band",
	},
};

export function rawEvent(overrides: Record<string, unknown> = {}) {
	return {
		id: 100,
		public_calendar_id: 1,
		title: "ワンマンライブ",
		note: "開場 18:00 / 開演 18:30",
		all_day: false,
		start_at: DEC_1 + 9 * 60 * 60 * 1000,
		end_at: DEC_1 + 11 * 60 * 60 * 1000,
		start_timezone: "Asia/Tokyo",
		end_timezone: "Asia/Tokyo",
		location_name: "",
		location_address: null,
		link_url: "",
		url: "https://timetr.ee/p/example_band/100",
		recurrences: null,
		created_at: DEC_1 - 30 * DAY,
		updated_at: DEC_1 - 2 * DAY,
		status: 1,
		...overrides,
	};
}

/** URL ごとに返事を決める偽の fetch。呼ばれた URL を残す */
export function fakeFetch(routes: (url: URL) => { status?: number; body: unknown } | undefined) {
	const calls: URL[] = [];
	const headers: Record<string, string>[] = [];
	const fetchLike: FetchLike = async (input, init) => {
		const url = new URL(input);
		calls.push(url);
		headers.push(init?.headers ?? {});
		const route = routes(url);
		if (!route) return new Response("not found", { status: 404 });
		return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
	};
	return { fetch: fetchLike, calls, headers };
}
