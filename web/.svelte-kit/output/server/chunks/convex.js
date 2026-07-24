import { t as public_env } from "./shared-server.js";
import { E as get, O as writable, T as derived } from "./server.js";
import "./index-server2.js";
import { componentsGeneric } from "convex/server";
import "convex/browser";
componentsGeneric();
var liveState = writable({});
var mockState = writable(createSeedState());
var syncStatus = writable({
	lastError: null,
	live: false,
	mode: "mock"
});
(public_env.PUBLIC_CONVEX_URL ?? "").trim();
var state = derived([mockState, liveState], ([$mockState, $liveState]) => mergeDashboardState($mockState, $liveState));
var cards = derived(state, ($state) => $state.cards);
var devices = derived(state, ($state) => $state.devices);
var scenes = derived(state, ($state) => $state.scenes);
var rules = derived(state, ($state) => $state.rules);
var sources = derived(state, ($state) => $state.sources);
var firmware = derived(state, ($state) => $state.firmware);
var telemetry = derived(state, ($state) => $state.telemetry);
var primaryDevice = derived(devices, ($devices) => $devices[0] ?? null);
var dashboardStatus = derived(syncStatus, ($status) => $status);
function createSeedState() {
	const now = Date.now();
	const cards = [
		buildCard({
			estimatedAmps: 1.08,
			name: "Bus 402",
			priority: 90,
			slug: "bus-402",
			source: {
				elements: [
					{
						color: "#f59e0b",
						font: "3x5",
						op: "text",
						value: "402",
						x: 1,
						y: 2
					},
					{
						bind: "bus.eta_min",
						color: "#ffffff",
						font: "5x7",
						op: "text",
						type: "number",
						x: 20,
						y: 2
					},
					{
						color: "#ffffff",
						font: "5x7",
						op: "text",
						value: "분",
						x: 36,
						y: 2
					},
					{
						bind: "bus.next_eta_min",
						color: "#8f9f8d",
						font: "3x5",
						op: "text",
						type: "number",
						x: 20,
						y: 12
					},
					{
						bind: "bus.headsign",
						color: "#a3b2a0",
						font: "3x5",
						op: "text",
						type: "string",
						x: 1,
						y: 24
					}
				],
				id: "bus-402"
			}
		}),
		buildCard({
			estimatedAmps: .92,
			name: "Weather",
			slug: "weather",
			source: {
				elements: [
					{
						bind: "wx.tempC",
						color: "#ffffff",
						font: "5x7",
						op: "text",
						type: "number",
						x: 1,
						y: 2
					},
					{
						color: "#ffffff",
						font: "5x7",
						op: "text",
						value: "C",
						x: 22,
						y: 2
					},
					{
						bind: "wx.condition",
						color: "#8f9f8d",
						font: "3x5",
						op: "text",
						type: "string",
						x: 1,
						y: 14
					}
				],
				id: "weather"
			}
		}),
		buildCard({
			estimatedAmps: .86,
			name: "Air Quality",
			slug: "air",
			source: {
				elements: [
					{
						color: "#8f9f8d",
						font: "3x5",
						op: "text",
						value: "PM2.5",
						x: 1,
						y: 2
					},
					{
						bind: "air.pm25",
						color: "#ffffff",
						font: "5x7",
						op: "text",
						type: "number",
						x: 1,
						y: 12
					},
					{
						bind: "air.grade",
						color: "#8f9f8d",
						font: "3x5",
						op: "text",
						type: "string",
						x: 24,
						y: 12
					}
				],
				id: "air"
			}
		}),
		buildCard({
			estimatedAmps: .55,
			name: "Clock",
			slug: "clock",
			source: {
				elements: [{
					color: "#ffffff",
					font: "5x7",
					op: "text",
					value: "07:21",
					x: 4,
					y: 4
				}, {
					bind: "calendar.dateLabel",
					color: "#7a8678",
					font: "3x5",
					op: "text",
					type: "string",
					x: 4,
					y: 18
				}],
				id: "clock"
			}
		}),
		buildCard({
			estimatedAmps: .19,
			name: "Clock Dim",
			slug: "clock-dim",
			source: {
				elements: [{
					color: "#5f665f",
					font: "5x7",
					op: "text",
					value: "07:21",
					x: 8,
					y: 10
				}],
				id: "clock-dim"
			}
		}),
		buildCard({
			estimatedAmps: .78,
			name: "Indoor",
			slug: "indoor",
			source: {
				elements: [
					{
						bind: "indoor.tempC",
						color: "#ffffff",
						font: "5x7",
						op: "text",
						type: "number",
						x: 1,
						y: 2
					},
					{
						color: "#ffffff",
						font: "5x7",
						op: "text",
						value: "C",
						x: 20,
						y: 2
					},
					{
						bind: "indoor.humidity",
						color: "#8f9f8d",
						font: "3x5",
						op: "text",
						type: "number",
						x: 1,
						y: 14
					},
					{
						color: "#8f9f8d",
						font: "3x5",
						op: "text",
						value: "%",
						x: 18,
						y: 14
					}
				],
				id: "indoor"
			}
		}),
		buildCard({
			estimatedAmps: .88,
			name: "Calendar Next",
			slug: "calendar-next",
			source: {
				elements: [
					{
						color: "#8f9f8d",
						font: "3x5",
						op: "text",
						value: "NEXT",
						x: 1,
						y: 2
					},
					{
						bind: "calendar.next.title",
						color: "#ffffff",
						font: "3x5",
						op: "text",
						type: "string",
						x: 1,
						y: 10
					},
					{
						bind: "calendar.next.startsAt",
						color: "#8f9f8d",
						font: "3x5",
						op: "text",
						type: "string",
						x: 1,
						y: 22
					}
				],
				id: "calendar-next"
			}
		}),
		buildCard({
			estimatedAmps: .94,
			name: "Self Status",
			slug: "self-status",
			source: {
				elements: [
					{
						color: "#8f9f8d",
						font: "3x5",
						op: "text",
						value: "RSSI",
						x: 1,
						y: 2
					},
					{
						bind: "telemetry.rssi",
						color: "#ffffff",
						font: "3x5",
						op: "text",
						type: "number",
						x: 24,
						y: 2
					},
					{
						color: "#8f9f8d",
						font: "3x5",
						op: "text",
						value: "PRG",
						x: 1,
						y: 12
					},
					{
						bind: "device.programVersion",
						color: "#ffffff",
						font: "3x5",
						op: "text",
						type: "number",
						x: 24,
						y: 12
					},
					{
						bind: "poke.message",
						color: "#ffffff",
						font: "3x5",
						op: "text",
						type: "string",
						x: 1,
						y: 24
					}
				],
				id: "self-status"
			}
		})
	];
	const sceneByName = {
		away: "scene-away",
		day: "scene-day",
		evening: "scene-evening",
		morning: "scene-morning",
		night: "scene-night"
	};
	return {
		cards,
		devices: [{
			_creationTime: now - 1e3,
			_id: "device-demo",
			activeSceneId: sceneByName.day,
			dataEtag: "\"seed-data\"",
			dataVersion: 12,
			fwChannel: "stable",
			fwVersion: "1.4.2",
			lastSeen: now,
			name: "Wall Matrix Panel Demo",
			online: true,
			programEtag: "\"seed-program\"",
			programVersion: 7,
			tokenHash: "demo-token"
		}],
		firmware: [{
			_creationTime: now - 14400 * 60 * 1e3,
			_id: "fw-1.4.2",
			channel: "stable",
			r2Url: "https://example.invalid/fw/matrix-1.4.2.bin",
			releasedAt: now - 14400 * 60 * 1e3,
			sha256: "f5d4384ce980dce2b70351f8e4dc5df1",
			signature: "ed25519:demo",
			version: "1.4.2"
		}, {
			_creationTime: now - 4320 * 60 * 1e3,
			_id: "fw-1.5.0-rc1",
			channel: "dev",
			r2Url: "https://example.invalid/fw/matrix-1.5.0-rc1.bin",
			releasedAt: now - 4320 * 60 * 1e3,
			sha256: "65d4384ce980dce2b70351f8e4dc5cab",
			signature: "ed25519:demo",
			version: "1.5.0-rc1"
		}],
		rules: [
			{
				_creationTime: now - 2e3,
				_id: "rule-bus-urgent",
				action: {
					cardId: "card-bus-402",
					durationMs: 6e4,
					kind: "pin"
				},
				condition: "bus.urgent == true",
				enabled: true,
				name: "bus urgent",
				priority: 100
			},
			{
				_creationTime: now - 2e3,
				_id: "rule-air-alert",
				action: {
					cardId: "card-air",
					durationMs: 45e3,
					kind: "interrupt"
				},
				condition: "air.alert == true",
				enabled: true,
				name: "air alert",
				priority: 95
			},
			{
				_creationTime: now - 2e3,
				_id: "rule-night",
				action: {
					kind: "scene",
					sceneId: sceneByName.night
				},
				condition: "time.hour >= 22 or time.hour < 6",
				enabled: true,
				name: "sleep",
				priority: 70
			},
			{
				_creationTime: now - 2e3,
				_id: "rule-away",
				action: {
					kind: "scene",
					sceneId: sceneByName.away
				},
				condition: "indoor.presenceRoom == false and time.hour >= 8",
				enabled: true,
				name: "room empty",
				priority: 60
			}
		],
		scenes: [
			buildScene("scene-morning", "morning", [
				"card-bus-402",
				"card-weather",
				"card-calendar-next",
				"card-air"
			], 1, 90, "weekday 06:30-09:30"),
			buildScene("scene-day", "day", [
				"card-weather",
				"card-indoor",
				"card-calendar-next",
				"card-self-status"
			], 2, 100),
			buildScene("scene-evening", "evening", [
				"card-clock",
				"card-weather",
				"card-indoor",
				"card-self-status"
			], 3, 65),
			buildScene("scene-night", "night", ["card-clock-dim"], 4, 15, "everyday 22:00-23:59"),
			buildScene("scene-away", "away", ["card-self-status", "card-air"], 5, 40)
		],
		sources: [
			buildSource("source-bus", "bus", "seoul.bus", {
				route: "402",
				arsId: "23-005"
			}, 2e4, "fly-nrt", now - 4e3, {
				crowding: 2,
				eta_min: 4,
				headsign: "402번 강남역 방면",
				next_eta_min: 12,
				urgent: false
			}),
			buildSource("source-wx", "wx", "kma.now", { station: "Seoul-108" }, 6e5, "fly-nrt", now - 12e4, {
				condition: "humid cloudy",
				icon: "cloud",
				rainProb: 30,
				tempC: 27.4
			}),
			buildSource("source-air", "air", "airkorea", { station: "Gangnam-gu" }, 6e5, "fly-nrt", now - 28e4, {
				alert: false,
				grade: "good",
				pm10: 31,
				pm25: 18
			}),
			buildSource("source-calendar", "calendar", "google.calendar", { calendarId: "primary" }, 3e5, "convex", now - 42e3, {
				dateLabel: "Fri 24 Jul",
				next: {
					startsAt: "19:30",
					title: "Dinner in Seongsu"
				}
			}),
			buildSource("source-spotify", "spotify", "spotify.nowPlaying", { account: "demo" }, 15e3, "convex", now - 6e3, {
				artist: "Balming Tiger",
				isPlaying: true,
				track: "Seoul"
			}),
			buildSource("source-github", "github", "github.repo", { repo: "injoon5/display" }, 6e5, "convex", now - 32e4, {
				failingChecks: 0,
				latest: "Convex backend bootstrap",
				openPullRequests: 2
			}),
			buildSource("source-indoor", "indoor", "panel.indoor", { room: "bedroom" }, 6e4, "convex", now - 5e3, {
				humidity: 51.2,
				presenceBed: false,
				presenceRoom: true,
				tempC: 24.1
			}),
			buildSource("source-poke", "poke", "panel.debug", { scope: "editor" }, 3e4, "convex", now - 2e3, { message: "preview synced" })
		],
		telemetry: {
			at: now,
			brightness: 62,
			estAmps: .84,
			governorActive: false,
			heapFree: 183e3,
			humidity: 51.2,
			lux: 128,
			presenceBed: false,
			presenceRoom: true,
			rssi: -54,
			tempC: 24.1
		}
	};
}
function buildScene(id, name, cardIds, homekitIdentifier, brightnessCeiling, schedule) {
	return {
		_creationTime: Date.now(),
		_id: id,
		brightnessCeiling,
		cardIds,
		enabled: true,
		homekitIdentifier,
		name,
		schedule
	};
}
function buildSource(id, sourceId, kind, config, intervalMs, origin, fetchedAt, data) {
	return {
		_creationTime: Date.now(),
		_id: id,
		config,
		consecutiveFailures: 0,
		data,
		fetchedAt,
		intervalMs,
		kind,
		origin,
		sourceId
	};
}
function buildCard(input) {
	const sourceString = JSON.stringify(input.source, null, 2);
	const slotMap = extractSlotMap(sourceString);
	return {
		_creationTime: Date.now(),
		_id: `card-${input.slug}`,
		diagnostics: [],
		dwellMs: 1e4,
		enabled: true,
		estimatedAmps: input.estimatedAmps,
		name: input.name,
		priority: input.priority ?? 50,
		slug: input.slug,
		slotMap,
		source: sourceString,
		sourceRefs: [...new Set(slotMap.map((entry) => entry.sourceId))],
		updatedAt: Date.now()
	};
}
function extractSlotMap(source) {
	try {
		const parsed = JSON.parse(source);
		if (!Array.isArray(parsed.elements)) return [];
		const seen = /* @__PURE__ */ new Set();
		const slotMap = [];
		for (const element of parsed.elements) {
			const bind = typeof element.bind === "string" ? element.bind : null;
			if (!bind || seen.has(bind)) continue;
			seen.add(bind);
			slotMap.push({
				index: slotMap.length,
				path: bind,
				sourceId: bind.split(".")[0] ?? "unknown",
				type: typeof element.type === "string" ? element.type : inferTypeFromPath(bind)
			});
		}
		return slotMap;
	} catch {
		return [];
	}
}
function inferTypeFromPath(path) {
	if (path.endsWith("urgent") || path.endsWith("online") || path.endsWith("alert")) return "boolean";
	if (path.endsWith("eta_min") || path.endsWith("tempC") || path.endsWith("humidity") || path.endsWith("pm25")) return "number";
	return "string";
}
function mergeDashboardState(mock, live) {
	return {
		cards: live.cards && live.cards.length > 0 ? live.cards : mock.cards,
		devices: live.devices && live.devices.length > 0 ? live.devices : mock.devices,
		firmware: live.firmware && live.firmware.length > 0 ? live.firmware : mock.firmware,
		rules: live.rules && live.rules.length > 0 ? live.rules : mock.rules,
		scenes: live.scenes && live.scenes.length > 0 ? live.scenes : mock.scenes,
		sources: live.sources && live.sources.length > 0 ? live.sources : mock.sources,
		telemetry: live.telemetry ?? mock.telemetry
	};
}
function getActiveScene(device) {
	if (!device?.activeSceneId) return null;
	return get(state).scenes.find((scene) => scene._id === device.activeSceneId) ?? null;
}
function buildSlotSnapshot(slotMap, options) {
	const sourceList = options.sources ?? get(state).sources;
	const device = options.device ?? get(primaryDevice);
	const telemetryValue = options.telemetry ?? get(state).telemetry;
	const overrides = options.overrides ?? {};
	const sourceMap = new Map(sourceList.map((source) => [source.sourceId, source]));
	const rootData = Object.fromEntries(sourceList.map((source) => [source.sourceId, source.data]));
	if (device) rootData.device = {
		fwVersion: device.fwVersion,
		lastSeen: device.lastSeen,
		name: device.name,
		online: device.online,
		programVersion: device.programVersion
	};
	rootData.telemetry = {
		brightness: telemetryValue.brightness,
		estAmps: telemetryValue.estAmps,
		governorActive: telemetryValue.governorActive,
		heapFree: telemetryValue.heapFree,
		humidity: telemetryValue.humidity,
		lux: telemetryValue.lux,
		presenceBed: telemetryValue.presenceBed,
		presenceRoom: telemetryValue.presenceRoom,
		rssi: telemetryValue.rssi,
		tempC: telemetryValue.tempC
	};
	const kst = new Intl.DateTimeFormat("en-US", {
		hour: "2-digit",
		hour12: false,
		minute: "2-digit",
		timeZone: "Asia/Seoul",
		weekday: "short"
	}).formatToParts(new Date(options.nowMs));
	rootData.time = {
		hour: Number(kst.find((part) => part.type === "hour")?.value ?? "0"),
		minute: Number(kst.find((part) => part.type === "minute")?.value ?? "0"),
		weekday: kst.find((part) => part.type === "weekday")?.value ?? "Mon"
	};
	const byIndex = {};
	const byPath = {};
	for (const entry of slotMap) {
		const baseValue = resolvePath(rootData, entry.path);
		const value = entry.path in overrides ? overrides[entry.path] : baseValue;
		const updatedMs = sourceMap.get(entry.sourceId)?.fetchedAt ?? device?.lastSeen ?? options.nowMs;
		const slot = {
			path: entry.path,
			sourceId: entry.sourceId,
			type: entry.type,
			updatedMs,
			value
		};
		byIndex[entry.index] = slot;
		byPath[entry.path] = slot;
	}
	return {
		byIndex,
		byPath
	};
}
function resolvePath(rootData, path) {
	const parts = path.split(".");
	let current = rootData;
	for (const part of parts) {
		if (!current || typeof current !== "object") return null;
		current = current[part];
	}
	return current ?? null;
}
//#endregion
export { getActiveScene as a, scenes as c, firmware as i, sources as l, cards as n, primaryDevice as o, dashboardStatus as r, rules as s, buildSlotSnapshot as t, telemetry as u };
