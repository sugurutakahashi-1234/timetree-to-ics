// TimeTree の公開カレンダーを読む。
// TimeTree の公式の API ではなく、Web 版（timetreeapp.com）が公開カレンダーの表示に使っている非公開の API を、ログインなしで読む。
// 公式の API は 2023-12 に終わっていて、外へ出す公式の方法は無い。API の形が変わったら、ここだけを直す。

/** TimeTree の Web 版の起点 */
const TIMETREE_ORIGIN = "https://timetreeapp.com";

// ヘッダーは X-Timetreea と User-Agent の 2 つとも付ける。Cloudflare Workers の fetch は User-Agent を付けず、
// どちらかが欠けると、予定の API は 400（code -401）を返す（2026-11 に確かめた。
// 家の回線からは欠けても返るので、手元の確かめだけでは気づけない）
/** このパッケージの版（TimeTree への User-Agent に使う） */
export const VERSION = "2.0.1";
const CLIENT_HEADER = {
	"X-Timetreea": "web/2.1.0/ja",
	"User-Agent": `timetree-to-ics/${VERSION} (+https://github.com/sugurutakahashi-1234/timetree-to-ics)`,
	Accept: "application/json",
} as const;

// 1 回で 300 件まで返り、続きは cursor で読む。止まらない読み方を防ぐ上限
const MAX_PAGES = 20;

/** `fetch` と同じ形の関数。テストや、独自の取得の仕方を差し込むときに渡す */
export type FetchLike = (
	input: string,
	init?: { headers?: Record<string, string>; signal?: AbortSignal | undefined },
) => Promise<Response>;

/** 公開カレンダーの情報 */
export type PublicCalendar = {
	/** 公開カレンダーの名前（`timetreeapp.com/public_calendars/<aliasCode>`） */
	aliasCode: string;
	/** カレンダーの表示名 */
	name: string;
	/** カレンダーを開く URL（`https://timetr.ee/p/<名前>` の形が多い） */
	url: string;
};

/** 公開カレンダーの予定 */
export type PublicEvent = {
	/** TimeTree の予定の ID。変わらないので、.ics の UID に使う */
	id: string;
	title: string;
	/** 予定のメモ（本文） */
	note: string;
	allDay: boolean;
	/** 開始時刻（UNIX 時間のミリ秒）。終日の予定は、その日の UTC の 0 時 */
	startAt: number;
	/** 終了時刻（UNIX 時間のミリ秒）。終日の予定は、最終日の UTC の 0 時（その日を含む） */
	endAt: number;
	/** 予定の時間帯（IANA の名前。例 `Asia/Tokyo`）。繰り返しの曜日を正しく出すのに使う。無ければ UTC とみなす */
	timezone?: string | undefined;
	locationName: string;
	locationAddress: string;
	/** 予定に付いた外部のリンク（チケットのページなど） */
	linkUrl: string;
	/** TimeTree で予定を開く URL */
	url: string;
	/** RRULE などの繰り返しの行。無ければ空 */
	recurrences: string[];
	/** 作成日時（UNIX 時間のミリ秒） */
	createdAt: number;
	/** 更新日時（UNIX 時間のミリ秒） */
	updatedAt: number;
};

/**
 * TimeTree を読めなかった理由の種類。
 * - `network`: TimeTree に届かなかった（`cause` に元のエラー）
 * - `http`: TimeTree がエラーを返した（`status` に HTTP の番号。名前が無いときは 400、混み合うと 429）
 * - `format`: 返事の形が想定と違った（API の形が変わった可能性）
 */
export type TimeTreeErrorKind = "network" | "http" | "format";

/** TimeTree を読めなかったときのエラー。空の .ics を返す代わりに投げる */
export class TimeTreeError extends Error {
	/** 読めなかった理由の種類 */
	readonly kind: TimeTreeErrorKind;
	/** TimeTree が返した HTTP の番号（`kind` が `http` のときと、返事の形が違ったとき） */
	readonly status: number | undefined;

	constructor(message: string, options: { kind: TimeTreeErrorKind; status?: number | undefined; cause?: unknown }) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });
		this.name = "TimeTreeError";
		this.kind = options.kind;
		this.status = options.status;
	}
}

const ALIAS = /^[A-Za-z0-9_-]{1,100}$/;
const FROM_URL = /(?:\/public_calendars\/|\btimetr\.ee\/p\/)([^/?#\s]+)/;

/**
 * 公開カレンダーの名前か URL から、名前を取り出す。次のどれも受ける。
 * - 名前: `example_team`
 * - Web 版の URL: `https://timetreeapp.com/public_calendars/example_team`
 * - アプリの共有で出る短い URL: `https://timetr.ee/p/example_team`（予定の URL `…/p/example_team/<予定の ID>` も可）
 * @throws {TypeError} どの形でもないとき（非公開のカレンダーの URL も含む）
 */
export function parseCalendarRef(input: string): string {
	const trimmed = input.trim();
	const alias = trimmed.match(FROM_URL)?.[1] ?? trimmed;
	if (!ALIAS.test(alias)) {
		// 入力をそのまま文に入れない（招待の URL の合言葉などがログに残らないように）
		throw new TypeError(
			"公開カレンダーの名前か URL ではありません。受け付けるのは、名前・https://timetreeapp.com/public_calendars/<名前>・https://timetr.ee/p/<名前> です（非公開のカレンダーは読めません）",
		);
	}
	return alias;
}

type RawCalendar = { alias_code?: string; name?: string; url?: string };

/**
 * 公開カレンダーの情報（表示名など）を読む。
 * @param calendar 公開カレンダーの名前か URL（{@link parseCalendarRef} の形）
 * @throws {TypeError} 名前か URL の形が違うとき
 * @throws {TimeTreeError} TimeTree を読めなかったとき
 */
export async function fetchPublicCalendar(
	calendar: string,
	options: { fetch?: FetchLike | undefined; signal?: AbortSignal | undefined } = {},
): Promise<PublicCalendar> {
	const ref = parseCalendarRef(calendar);
	const body = await getJson(options.fetch ?? fetch, `${TIMETREE_ORIGIN}/api/v2/public_calendars/${ref}`, options.signal);
	const raw = (body as { public_calendar?: RawCalendar }).public_calendar;
	if (typeof raw?.name !== "string") {
		throw new TimeTreeError("公開カレンダーの返事に名前がありません（API の形が変わった可能性）", { kind: "format" });
	}
	return {
		aliasCode: raw.alias_code ?? ref,
		name: raw.name,
		url: raw.url ?? `${TIMETREE_ORIGIN}/public_calendars/${ref}`,
	};
}

type RawEvent = {
	id?: string | number;
	title?: string;
	note?: string;
	all_day?: boolean;
	start_at?: number;
	end_at?: number;
	start_timezone?: string;
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

/** {@link fetchPublicEvents} のオプション */
export type FetchEventsOptions = {
	/** この時刻以降の予定を読む */
	from: Date;
	/** この時刻までの予定を読む */
	to: Date;
	fetch?: FetchLike | undefined;
	/** 読むのを途中でやめるとき */
	signal?: AbortSignal | undefined;
	/** TimeTree に渡す、見る人の時差（秒）。終日の予定の範囲の扱いに効く。既定は日本時間（32400） */
	utcOffsetSeconds?: number | undefined;
};

/**
 * 公開カレンダーの予定を、from から to までの範囲で読む。
 * 範囲の扱いは TimeTree の側が決めるので、厳密に絞りたいときは呼ぶ側でもう一度絞る。
 * @param calendar 公開カレンダーの名前か URL（{@link parseCalendarRef} の形）
 * @throws {TypeError} 名前か URL の形が違うとき
 * @throws {RangeError} from・to が無効な日付のとき、from が to より後のとき、予定が 6000 件を超えたとき
 * @throws {TimeTreeError} TimeTree を読めなかったとき
 */
export async function fetchPublicEvents(calendar: string, options: FetchEventsOptions): Promise<PublicEvent[]> {
	const ref = parseCalendarRef(calendar);
	const from = options.from.getTime();
	const to = options.to.getTime();
	if (!Number.isFinite(from) || !Number.isFinite(to)) {
		throw new RangeError("from・to は有効な日付にしてください");
	}
	if (from > to) {
		throw new RangeError("from は to より前にしてください");
	}
	const base = new URL(`${TIMETREE_ORIGIN}/api/v2/public_calendars/${ref}/public_events`);
	base.searchParams.set("from", String(from));
	base.searchParams.set("to", String(to));
	base.searchParams.set("utc_offset", String(options.utcOffsetSeconds ?? 9 * 60 * 60));

	const events: PublicEvent[] = [];
	let cursor: string | undefined;
	for (let page = 0; page < MAX_PAGES; page++) {
		const url = new URL(base);
		if (cursor) url.searchParams.set("cursor", cursor);
		const body = (await getJson(options.fetch ?? fetch, url.toString(), options.signal)) as RawEventsPage;
		if (!Array.isArray(body.public_events)) {
			throw new TimeTreeError("予定の返事に public_events がありません（API の形が変わった可能性）", {
				kind: "format",
			});
		}
		events.push(...body.public_events.map(normalizeEvent));
		if (!body.paging?.next || !body.paging.next_cursor) return events;
		cursor = body.paging.next_cursor;
	}
	// 呼ぶ側が範囲を狭めれば読めるので、API の変化（format）ではなく範囲の誤りとして返す
	throw new RangeError(`予定が ${MAX_PAGES * 300} 件を超えました。範囲（日数）を狭めてください`);
}

function normalizeEvent(raw: RawEvent): PublicEvent {
	const id = raw.id;
	const startAt = raw.start_at;
	const endAt = raw.end_at;
	// 欠けた予定を黙って落とすと、全部落ちたときに空の .ics になり、購読した側の予定が全部消える
	if (
		(typeof id !== "string" && typeof id !== "number") ||
		typeof startAt !== "number" ||
		!Number.isFinite(startAt) ||
		typeof endAt !== "number" ||
		!Number.isFinite(endAt)
	) {
		throw new TimeTreeError("予定に ID か時刻がありません（API の形が変わった可能性）", { kind: "format" });
	}
	return {
		id: String(id),
		title: raw.title ?? "",
		note: raw.note ?? "",
		allDay: raw.all_day === true,
		startAt,
		endAt,
		timezone: typeof raw.start_timezone === "string" && raw.start_timezone ? raw.start_timezone : undefined,
		locationName: raw.location_name ?? "",
		locationAddress: raw.location_address ?? "",
		linkUrl: raw.link_url ?? "",
		url: raw.url ?? "",
		recurrences: Array.isArray(raw.recurrences) ? raw.recurrences.filter((line) => typeof line === "string") : [],
		createdAt: raw.created_at ?? raw.updated_at ?? startAt,
		updatedAt: raw.updated_at ?? raw.created_at ?? startAt,
	};
}

async function getJson(doFetch: FetchLike, url: string, signal: AbortSignal | undefined): Promise<object> {
	let response: Response;
	try {
		response = await doFetch(url, { headers: { ...CLIENT_HEADER }, signal });
	} catch (error) {
		throw new TimeTreeError(
			`TimeTree に接続できません: ${error instanceof Error ? error.message : String(error)}`,
			{ kind: "network", cause: error },
		);
	}
	if (!response.ok) {
		const hint =
			response.status === 400 || response.status === 404
				? "（公開カレンダーの名前が違う可能性があります）"
				: response.status === 429
					? "（読む回数が多すぎます。間を空けてください）"
					: "";
		throw new TimeTreeError(`TimeTree が ${response.status} を返しました${hint}`, { kind: "http", status: response.status });
	}
	let body: unknown;
	try {
		body = await response.json();
	} catch (error) {
		throw new TimeTreeError("TimeTree の返事が JSON ではありません（API の形が変わった可能性）", {
			kind: "format",
			status: response.status,
			cause: error,
		});
	}
	if (typeof body !== "object" || body === null) {
		throw new TimeTreeError("TimeTree の返事が想定の形ではありません（API の形が変わった可能性）", {
			kind: "format",
			status: response.status,
		});
	}
	return body;
}
