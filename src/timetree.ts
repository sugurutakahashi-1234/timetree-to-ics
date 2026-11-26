// TimeTree の公開カレンダーを読む。
// TimeTree の公式の API ではなく、ウェブ版（timetreeapp.com）が公開カレンダーの表示に使っている口を、ログインなしで読む。
// 公式の API は 2023-12 に終わっていて、外へ出す公式の方法は無い。口の形が変わったら、ここだけを直す。

export const TIMETREE_ORIGIN = "https://timetreeapp.com";

// 名乗りは 2 つとも付ける。Cloudflare Workers の fetch は User-Agent を付けず、
// X-Timetreea と User-Agent のどちらかが欠けると、予定の口は 400（code -401）を返す（2026-11 に確かめた。
// 家の回線からは欠けても返るので、手元の確かめだけでは気づけない）
export const VERSION = "0.2.0";
const CLIENT_HEADER = {
	"X-Timetreea": "web/2.1.0/ja",
	"User-Agent": `timetree-to-ics/${VERSION} (+https://github.com/sugurutakahashi-1234/timetree-to-ics)`,
	Accept: "application/json",
} as const;

// 1 回で 300 件まで返り、続きは cursor で読む。止まらない読み方を防ぐ上限
const MAX_PAGES = 20;

export type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

export type PublicCalendar = {
	/** URL に出る名前（`timetreeapp.com/public_calendars/<aliasCode>`） */
	aliasCode: string;
	name: string;
	url: string;
};

export type PublicEvent = {
	id: string;
	title: string;
	note: string;
	allDay: boolean;
	/** 始まりの時刻（ミリ秒）。終日の予定は、その日の UTC の 0 時 */
	startAt: number;
	/** 終わりの時刻（ミリ秒）。終日の予定は、最後の日の UTC の 0 時（その日を含む） */
	endAt: number;
	locationName: string;
	locationAddress: string;
	linkUrl: string;
	/** TimeTree で予定を開く URL */
	url: string;
	/** RRULE などの繰り返しの行。無ければ空 */
	recurrences: string[];
	createdAt: number;
	updatedAt: number;
};

export class TimeTreeError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = "TimeTreeError";
	}
}

const ALIAS = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * 公開カレンダーの名前か URL から、名前（alias）を取り出す。
 * `example_band`・`https://timetreeapp.com/public_calendars/example_band` のどちらも受ける。
 */
export function parseCalendarRef(input: string): string {
	const trimmed = input.trim();
	const fromUrl = trimmed.match(/\/public_calendars\/([^/?#]+)/)?.[1];
	const alias = fromUrl ?? trimmed;
	if (!ALIAS.test(alias)) {
		throw new TypeError(`公開カレンダーの名前か URL ではない: ${input}`);
	}
	return alias;
}

type RawCalendar = { alias_code?: string; name?: string; url?: string };

export async function fetchPublicCalendar(alias: string, options: { fetch?: FetchLike } = {}): Promise<PublicCalendar> {
	const doFetch = options.fetch ?? fetch;
	const ref = parseCalendarRef(alias);
	const body = (await getJson(doFetch, `${TIMETREE_ORIGIN}/api/v2/public_calendars/${ref}`)) as {
		public_calendar?: RawCalendar;
	};
	const raw = body.public_calendar;
	if (!raw?.name) {
		throw new TimeTreeError("公開カレンダーの返事に名前が無い（口の形が変わった可能性）");
	}
	return {
		aliasCode: raw.alias_code ?? ref,
		name: raw.name,
		url: raw.url ?? `${TIMETREE_ORIGIN}/public_calendars/${ref}`,
	};
}

type RawEvent = {
	id: string | number;
	title?: string;
	note?: string;
	all_day?: boolean;
	start_at: number;
	end_at: number;
	location_name?: string;
	location_address?: string | null;
	link_url?: string;
	url?: string;
	recurrences?: string[] | null;
	created_at?: number;
	updated_at?: number;
};

type RawEventsPage = {
	public_events?: RawEvent[];
	paging?: { next?: boolean; next_cursor?: string };
};

/**
 * 公開カレンダーの予定を、from から to までの範囲で読む。
 * 範囲の扱いは TimeTree の側が決めるので、厳密に絞りたいときは呼ぶ側でもう一度絞る。
 */
export async function fetchPublicEvents(
	alias: string,
	options: { from: Date; to: Date; fetch?: FetchLike; utcOffsetSeconds?: number },
): Promise<PublicEvent[]> {
	const doFetch = options.fetch ?? fetch;
	const ref = parseCalendarRef(alias);
	const base = new URL(`${TIMETREE_ORIGIN}/api/v2/public_calendars/${ref}/public_events`);
	base.searchParams.set("from", String(options.from.getTime()));
	base.searchParams.set("to", String(options.to.getTime()));
	// ウェブ版は見ている人の時差を秒で渡す。日本時間を既定にする
	base.searchParams.set("utc_offset", String(options.utcOffsetSeconds ?? 9 * 60 * 60));

	const events: PublicEvent[] = [];
	let cursor: string | undefined;
	for (let page = 0; page < MAX_PAGES; page++) {
		const url = new URL(base);
		if (cursor) url.searchParams.set("cursor", cursor);
		const body = (await getJson(doFetch, url.toString())) as RawEventsPage;
		if (!Array.isArray(body.public_events)) {
			throw new TimeTreeError("予定の返事に public_events が無い（口の形が変わった可能性）");
		}
		events.push(...body.public_events.map(normalizeEvent));
		if (!body.paging?.next || !body.paging.next_cursor) return events;
		cursor = body.paging.next_cursor;
	}
	throw new TimeTreeError(`予定が ${MAX_PAGES} 回読んでも終わらない`);
}

function normalizeEvent(raw: RawEvent): PublicEvent {
	return {
		id: String(raw.id),
		title: raw.title ?? "",
		note: raw.note ?? "",
		allDay: raw.all_day === true,
		startAt: raw.start_at,
		endAt: raw.end_at,
		locationName: raw.location_name ?? "",
		locationAddress: raw.location_address ?? "",
		linkUrl: raw.link_url ?? "",
		url: raw.url ?? "",
		recurrences: raw.recurrences ?? [],
		createdAt: raw.created_at ?? raw.updated_at ?? raw.start_at,
		updatedAt: raw.updated_at ?? raw.created_at ?? raw.start_at,
	};
}

async function getJson(doFetch: FetchLike, url: string): Promise<unknown> {
	let response: Response;
	try {
		response = await doFetch(url, { headers: { ...CLIENT_HEADER } });
	} catch (error) {
		throw new TimeTreeError(`TimeTree に届かない: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!response.ok) {
		// 無い名前は 400 で返る
		const hint = response.status === 400 || response.status === 404 ? "（公開カレンダーの名前が違う可能性）" : "";
		throw new TimeTreeError(`TimeTree が ${response.status} を返した${hint}`, response.status);
	}
	try {
		return await response.json();
	} catch {
		throw new TimeTreeError("TimeTree の返事が JSON ではない（口の形が変わった可能性）", response.status);
	}
}
