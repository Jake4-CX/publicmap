import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-draw/dist/leaflet.draw";

import { Time } from "e";
import { DIVISOR, EPOCH_LOCATION, type Location, tileServers } from "./universal";

export const hiddenUsers = new Set(["snoopy"]);

const livesRemainingCache = new Map<string, number>();
const batteryCache = new Map<string, number>();
const userMarkers = new Map<string, L.Marker<any>>();

function trySetMarkerTooltip(kickUsername: string) {
	const marker = userMarkers.get(kickUsername);
	if (marker) {
		marker.setTooltipContent(
			`${kickUsername}: ${batteryCache.get(kickUsername) ?? "Unknown"}% battery, ${livesRemainingCache.get(kickUsername) ?? "Unknown"} lives remaining`,
		);
	}
}
async function update() {
	try {
		const res = await fetch("https://appapi.iceposeidon.com/public").then((res) => res.json());
		if (Array.isArray(res)) {
			for (const user of res) {
				livesRemainingCache.set(user.name, user.lives_remaining);
				trySetMarkerTooltip(user.name);
			}
		}
	} catch (_) {}
}

setInterval(async () => {
	update();
}, Time.Minute);

setTimeout(() => {
	update();
}, 1000 * 1.5);

function createDefs(svg: any) {
	const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
	svg.appendChild(defs);
	return defs;
}

function createMask(defs: any) {
	const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
	mask.setAttribute("id", "mask");
	defs.appendChild(mask);
	const maskRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	maskRect.setAttribute("x", "0");
	maskRect.setAttribute("y", "0");
	maskRect.setAttribute("width", "100%");
	maskRect.setAttribute("height", "100%");
	maskRect.setAttribute("fill", "white");
	mask.appendChild(maskRect);

	return mask;
}

export function initLeafletMap({
	mapID,
	tileServer = tileServers.arcGIS,
	showGoal = false,
	mapOptions,
	radiusMeters,
	center,
	totalBoundary,
}: {
	totalBoundary: Location[];
	mapID: string;
	center: Location;
	radiusMeters: number;
	tileServer?: string;
	showGoal?: boolean;
	circleUpdateInterval?: number;
	mapOptions?: L.MapOptions;
}) {
	const centerTuple: [number, number] = [center.latitude, center.longitude];
	const circle = L.circle(centerTuple, {
		fillOpacity: 0,
		radius: radiusMeters,
		color: "rgba(0, 255, 0, 0.6)",
	});

	const circleMarker = L.circleMarker(centerTuple, {
		radius: 2,
		color: "magenta",
		fillColor: "cyan",
		fillOpacity: 1,
	});

	const circlesLayer = L.layerGroup([circleMarker, circle]);

	const totalRanchPolygonOutline = L.polygon(
		totalBoundary.map((l) => [l.latitude, l.longitude]),
		{ color: "rgba(255,0,0,0.5)", fillOpacity: 0 },
	);
	const totalRanchPolygon = L.polygon(
		totalBoundary.map((l) => [l.latitude, l.longitude]),
		{ color: "rgba(255,0,0,0.3)", fillOpacity: 0.6 },
	);
	const polyLayer = L.layerGroup([totalRanchPolygon, totalRanchPolygonOutline]);

	const map = L.map(mapID, {
		attributionControl: false,
		zoomSnap: 0,
		layers: [circlesLayer, polyLayer],
		center: centerTuple,
		maxBoundsViscosity: 0.6,
		maxBounds: totalRanchPolygon.getBounds().pad(1),
		...mapOptions,
	});

	map.setView(centerTuple, 15);

	/**
	 *
	 * Fix tile borders
	 *
	 */
	// @ts-ignore
	const originalInitTile = L.GridLayer.prototype._initTile;
	L.GridLayer.include({
		_initTile: function (tile: any) {
			originalInitTile.call(this, tile);
			const tileSize = this.getTileSize();
			tile.style.width = `${tileSize.x + 1}px`;
			tile.style.height = `${tileSize.y + 1}px`;
		},
	});
	L.tileLayer(tileServer).addTo(map);

	/**
	 *
	 * Fix clipping
	 *
	 */
	function handleClip() {
		const svg = map.getPanes().overlayPane.querySelector("svg");
		const defs = svg?.querySelector("defs") || createDefs(svg);
		const mask = defs.querySelector("#mask") || createMask(defs);

		const centerPoint = map.latLngToLayerPoint(circle.getLatLng());
		const radiusInPixels =
			circle.getRadius() / map.distance(map.containerPointToLatLng([0, 0]), map.containerPointToLatLng([1, 0]));
		const circlePathD = `M ${centerPoint.x} ${centerPoint.y} m -${radiusInPixels}, 0 a ${radiusInPixels},${radiusInPixels} 0 1,0 ${radiusInPixels * 2},0 a ${radiusInPixels},${radiusInPixels} 0 1,0 -${radiusInPixels * 2},0`;
		updateMask(mask, circlePathD);

		const polygonElement = totalRanchPolygon.getElement();
		if (polygonElement) {
			polygonElement.setAttribute("mask", "url(#mask)");
		}
	}

	function updateMask(mask: any, pathD: any) {
		while (mask.childNodes.length > 1) {
			mask.removeChild(mask.lastChild);
		}

		const maskRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
		maskRect.setAttribute("x", "0");
		maskRect.setAttribute("y", "0");
		maskRect.setAttribute("width", "100%");
		maskRect.setAttribute("height", "100%");
		maskRect.setAttribute("fill", "white");
		mask.appendChild(maskRect);

		const circlePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
		circlePath.setAttribute("d", pathD);
		circlePath.setAttribute("fill", "black");
		mask.appendChild(circlePath);
	}

	map.on("zoom", handleClip);
	map.on("move", handleClip);

	handleClip();
	handleClip();

	const animationRequests = new Map<string, number>();
	function animateMarker(marker: any, newPosition: any, duration: any) {
		const start = performance.now();
		const startPosition = marker.getLatLng();
		const deltaLat = newPosition.lat - startPosition.lat;
		const deltaLng = newPosition.lng - startPosition.lng;

		if (animationRequests.has(marker._leaflet_id)) {
			cancelAnimationFrame(animationRequests.get(marker._leaflet_id)!);
		}

		function animate() {
			const now = performance.now();
			const elapsed = now - start;
			const progress = Math.min(elapsed / duration, 1);

			const currentLat = startPosition.lat + deltaLat * progress;
			const currentLng = startPosition.lng + deltaLng * progress;
			marker.setLatLng([currentLat, currentLng]);

			if (progress < 1) {
				const requestId = requestAnimationFrame(animate);
				animationRequests.set(marker._leaflet_id, requestId);
			} else {
				animationRequests.delete(marker._leaflet_id);
			}
		}

		const requestId = requestAnimationFrame(animate);
		animationRequests.set(marker._leaflet_id, requestId);
	}

	function updateUserLocation({
		kickUsername,
		displayName,
		flags,
		lat,
		lng,
		avatar,
		real,
		battery,
	}: {
		kickUsername: string;
		displayName: string | null;
		flags: number[];
		lat: number;
		lng: number;
		avatar?: string | null;
		real: boolean;
		battery?: number;
	}) {
		if (hiddenUsers.has(kickUsername)) return;
		if (!displayName) displayName = kickUsername;
		if (!real) {
			lng = (lng + EPOCH_LOCATION.longitude * DIVISOR) / DIVISOR;
			lat = (lat + EPOCH_LOCATION.latitude * DIVISOR) / DIVISOR;
		}

		const loc = L.latLng(lat, lng);
		const cached = userMarkers.get(kickUsername);
		const cachedNoAnimation = userMarkers.get(`n-${kickUsername}`);
		if (cached) {
			animateMarker(cached, loc, 4000);
			if (cachedNoAnimation) cachedNoAnimation.setLatLng(loc);
		} else {
			const classNames = [];
			if (flags.includes(2)) classNames.push("hunter");
			if (flags.includes(5)) classNames.push("ingulag");

			const marker = L.marker(loc, {
				icon: L.divIcon({
					className: "user-marker",
					html: `<a target="_blank" style="text-decoration:none;" href="https://kick.com/${kickUsername}">
					<div class="user-marker-inner ${classNames.join(" ")}">
						<div style="display:flex;align-content:center;">
							<img class="avatar-image" style="margin-right:5px;border-radius:5px;" src="${avatar?.startsWith("/") ? avatar : `/assets/profile_icons/${kickUsername}.webp`}" height="16px" width="16px" />
							<div class="username">${displayName}</div>
						</div>
					</div>
				</a>`,
				}),
			})
				.addTo(map)
				.bindTooltip("Loading", {
					direction: "bottom",
					offset: [0, -20],
				});

			trySetMarkerTooltip(kickUsername);
			if (battery) batteryCache.set(kickUsername, battery);

			marker.on("mouseover", (ev) => {
				ev.target.openPopup();
			});

			userMarkers.set(kickUsername, marker);
			if (showGoal) {
				const targetMarker = L.marker(loc, {
					icon: L.divIcon({
						html: '<div style="width: 5px; height: 5px; background-color: magenta; border-radius: 50%; transform: translateX(-50%);"></div>',
						className: "",
					}),
				}).addTo(map);
				userMarkers.set(`n-${kickUsername}`, targetMarker);
			}
			updatePanel();
		}
	}

	function deleteUser(kickUsername: string) {
		userMarkers.get(kickUsername)?.remove();
		userMarkers.get(`n-${kickUsername}`)?.remove();
		userMarkers.delete(kickUsername);
		userMarkers.delete(`n-${kickUsername}`);
	}

	function update(settings: {
		current_circle_center_latitude: number;
		current_circle_center_longitude: number;
		current_circle_radius_meters: number;
	}) {
		circle.setRadius(settings.current_circle_radius_meters);
		circle.setLatLng([settings.current_circle_center_latitude, settings.current_circle_center_longitude]);
		circleMarker.setLatLng([settings.current_circle_center_latitude, settings.current_circle_center_longitude]);
		handleClip();
	}

	/**
	 * Night mode
	 */
	const applyNightMode = () => {
		const texasTimezone = "America/Chicago";
		const now = new Date().toLocaleString("en-US", { timeZone: texasTimezone });
		const currentHour = new Date(now).getHours() + 1;
		let filterClass = "";

		if (currentHour >= 4 && currentHour < 8) {
			filterClass = "evening";
		} else if (currentHour >= 8 && currentHour < 20) {
			filterClass = "daytime";
		} else if (currentHour >= 20 && currentHour <= 21) {
			filterClass = "evening";
		} else {
			filterClass = "nighttime";
		}

		filterClass = "daytime";

		const mapContainer = document.getElementById("map");
		if (mapContainer) {
			mapContainer.classList.remove("daytime", "evening", "nighttime");
			mapContainer.classList.add(filterClass);
		}
	};
	applyNightMode();
	setInterval(applyNightMode, 60 * 60 * 1000);

	/**
	 * Water stations
	 */
	for (const [lat, lng] of [
		[28.486115, -97.76903],
		[28.484921, -97.774269],
		[28.478329, -97.766972],
		[28.47948, -97.769594],
		[28.482586, -97.771165],
		[28.480669, -97.763382],
		[28.485161, -97.760405],
		[28.481198, -97.758624],
		[28.488157, -97.762859],
	]) {
		L.marker([lat, lng], {
			icon: L.divIcon({
				className: "user-marker",
				html: `<img style="height:25px;max-height:25px; margin-left:-8px;margin-top:-6px; opacity:0.75;" src="/assets/map_assets/water.png" />`,
			}),
		}).addTo(map);
	}

	/**
	 * Out of bounds
	 */
	const oob: [number, number][][] = [
		[
			[28.4865, -97.77349],
			[28.48755, -97.77241],
			[28.48836, -97.77376],
			[28.48771, -97.7746],
		],
		[
			[28.48706, -97.77565],
			[28.48696, -97.77615],
			[28.48806, -97.77703],
			[28.48852, -97.77619],
			[28.4876, -97.77552],
		],
	];
	for (const polyArr of oob) {
		const poly = L.polygon(
			polyArr.map(([lat, lng]) => [lat, lng]),
			{ color: "rgba(0,0,0,0.9)", fillOpacity: 0.6 },
		);

		poly.addTo(map);
		L.marker(poly.getCenter(), {
			icon: L.divIcon({
				className: "oob",
				html: `<p class="oob">DONT ENTER 🚫</p>`,
			}),
		}).addTo(map);
	}

	const panel = new L.Control({ position: "topright" });

	function updatePanel() {
		const div = L.DomUtil.create("div", "leaflet-control-layers leaflet-control picker");

		for (const [kickUsername, marker] of Array.from(userMarkers.entries()).sort(
			(a, b) => b[1].getLatLng().lat - a[1].getLatLng().lat,
		)) {
			if (map.getBounds().contains(marker.getLatLng())) {
				const button = L.DomUtil.create("button", "userpick", div);
				button.innerHTML = `${kickUsername}`;
				button.onclick = () => map.setView(marker.getLatLng(), 13);
			}
		}
		const container = panel.getContainer();
		if (container) {
			container.innerHTML = div.innerHTML;
			for (const button of container.querySelectorAll(".userpick")) {
				(button as HTMLButtonElement).onclick = () => {
					const username = button.innerHTML;
					const marker = userMarkers.get(username);
					if (marker) {
						map.setView(marker.getLatLng(), 25);
					}
				};
			}
		}
		// apply onclick listeners
	}

	panel.onAdd = () => {
		const div = L.DomUtil.create("div", "leaflet-control-layers leaflet-control picker");

		for (const [kickUsername, marker] of userMarkers.entries()) {
			const button = L.DomUtil.create("button", "", div);
			button.innerHTML = `${kickUsername}`;
			button.onclick = () => map.setView(marker.getLatLng(), 1);
		}
		return div;
	};

	updatePanel();

	panel.addTo(map);

	map.on("zoomend", updatePanel);
	map.on("moveend", updatePanel);

	return {
		updateUserLocation,
		deleteUser,
		map,
		update,
	};
}
