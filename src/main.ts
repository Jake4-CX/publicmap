import "./style.css";
import "leaflet/dist/leaflet.css";
import "./map.css";

import { initLeafletMap, updateAllUserMarkers } from "./map";
import { getTotalRanchPolygon } from "./universal";
import { initiateWs } from "./websocket";

initiateWs();

const poly = getTotalRanchPolygon();
export const map = initLeafletMap({
	mapID: "map",
	totalBoundary: getTotalRanchPolygon(),
	center: poly[0],
	radiusMeters: 0,
});

export const settings: string[] = [];
const div = document.getElementById("key")!;
const menu = document.createElement("div");
menu.classList.add("menu");

const settingsSource = [
	{
		name: "Hide Lives",
		value: "hidelb"
	}
];

for (const s of settingsSource) {
	const label = document.createElement("label");
	label.htmlFor = s.value;
	label.innerText = s.name;
	label.classList.add("setting");
	menu.appendChild(label);

	const setting = document.createElement("input");
	setting.id = s.value;
	setting.type = "checkbox";
	setting.innerText = s.name;
	setting.classList.add("setting");
	setting.name = s.value;
	setting.addEventListener("click", () => {
		const index = settings.indexOf(s.value);
		if (index === -1) {
			settings.push(s.value);
			setting.classList.add("selected");
		} else {
			settings.splice(index, 1);
			setting.classList.remove("selected");
		}
		updateAllUserMarkers();
	});

	menu.appendChild(setting);
}

div.appendChild(menu);
