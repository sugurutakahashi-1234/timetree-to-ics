// 本物の TimeTree の公開カレンダーを読み、API の形が変わっていないかを確かめる（週 1 回の live.yml が流す）。
// テストはテスト用データの返事しか使わないので、TimeTree の側の変更にはこれでしか気づけない。
// 読むカレンダーは環境変数 TIMETREE_LIVE_CALENDAR で渡す。公開のログに出るので、名前と予定の中身は表示しない
import ICAL from "ical.js";
import { fetchPublicEvents, timetreeToIcs } from "../src/index.ts";

const DAY = 24 * 60 * 60 * 1000;
const calendar = process.env.TIMETREE_LIVE_CALENDAR;
if (!calendar) {
	console.log("TIMETREE_LIVE_CALENDAR が無いので飛ばした");
	process.exit(0);
}

const result = await timetreeToIcs(calendar);
if (!result.calendar.name) throw new Error("カレンダーの名前が空（API の形が変わった可能性）");
ICAL.parse(result.ics);

// 今後の予定は 0 件のこともあるので、前後 1 年で 1 件以上読めるかで形を確かめる
const around = await fetchPublicEvents(calendar, { from: new Date(Date.now() - 365 * DAY), to: new Date(Date.now() + 365 * DAY) });
if (around.length === 0) throw new Error("前後 1 年の予定が 0 件（API の形が変わった可能性）");

console.log(`読めた: 今後の予定 ${result.events.length} 件・前後 1 年の予定 ${around.length} 件`);
