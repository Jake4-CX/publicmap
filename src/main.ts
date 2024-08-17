import "./style.css";
import "leaflet/dist/leaflet.css";
import "./map.css";

import { initLeafletMap } from "./map";
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
