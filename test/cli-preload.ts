// コマンドのテストで、TimeTree の代わりに見本を返す。`bun --preload` で読み込む
import { calendarBody, DAY, fakeFetch, rawEvent } from "./fixtures.ts";

// コマンドは今の時刻で絞るので、いつ回しても 1 週間先にある予定にする
const start = Date.now() + 7 * DAY;

const { fetch } = fakeFetch((url) => {
	if (url.pathname === "/api/v2/public_calendars/example_band") return { body: calendarBody };
	if (url.pathname.endsWith("/public_events")) {
		return { body: { public_events: [rawEvent({ start_at: start, end_at: start + 2 * 60 * 60 * 1000 })], paging: {} } };
	}
	return undefined;
});
globalThis.fetch = fetch as typeof globalThis.fetch;
