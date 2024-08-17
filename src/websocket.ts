import brotliPromise from "brotli-wasm";

import { config } from "./config";
import { map } from "./main";
import { hiddenUsers } from "./map";
import { type SettingsArray, type UserArray, decode } from "./util";

function disable(_reason: string) {
	alert("The map has been disabled. Come back later.");
	config.wasKilled = true;
	document.getElementById("map")?.remove();
	const el = document.createElement("div");
	el.style.position = "absolute";
	el.style.top = "50%";
	el.style.left = "50%";
	el.style.transform = "translate(-50%, -50%)";
	el.style.fontSize = "2rem";
	el.innerHTML =
		'<p>The map has been disabled. Come back later.</p><img width="300px" src="news.png" style="margin-left: 30%;transform:rotateZ(-50deg);" />';
	document.body.appendChild(el);
}

export async function initiateWs(retryCount = 0) {
	if (config.wasKilled) return;
	const brotli = await brotliPromise;
	//"http://localhost:1234/ws"
	let ws: WebSocket | null = new WebSocket("https://ws.iceposeidon.com/ws");
	ws.addEventListener("message", async (event) => {
		const arrayBuffer = await event.data.arrayBuffer();
		const decompressed = decode(new Uint8Array(arrayBuffer), brotli.decompress);
		if (typeof decompressed === "string") {
			if (decompressed.startsWith("HIDE:")) {
				const kickName = decompressed.replace("HIDE:", "");
				hiddenUsers.add(kickName);
				map.deleteUser(kickName);
			} else if (decompressed === "DISABLE") {
				disable("DISABLED_BY_SERVER");
				ws?.close();
				return;
			}
		} else {
			for (const item of decompressed) {
				if (item[0] === "S") {
					const settings = item as SettingsArray;
					const [, mapEnabled, _circlePaused, radius, latitude, longitude] = settings;
					map.update({
						current_circle_center_latitude: latitude,
						current_circle_center_longitude: longitude,
						current_circle_radius_meters: radius,
					});
					if (!mapEnabled) {
						disable("DISABLED_BY_SERVER_SETTINGS");
						ws?.close();
						return;
					}
				} else {
					const user = item as UserArray;
					map.updateUserLocation({
						kickUsername: user[0],
						displayName: typeof user[1] === "string" ? user[1] : null,
						flags: user[2],
						lat: user[3],
						lng: user[4],
						avatar: typeof user[5] === "string" ? user[5] : null,
						real: false,
						battery: user[6],
					});
				}
			}
		}
	});
	ws.addEventListener("close", () => {
		if (config.wasKilled) return;
		ws?.close();
		ws = null;
		if (retryCount >= 5) {
			config.wasKilled = true;
			disable("FAILED");
			return;
		}
		setTimeout(
			() => {
				initiateWs(retryCount + 1);
			},
			1000 * (retryCount + Math.ceil(Math.random() * 10)),
		);
	});
}
