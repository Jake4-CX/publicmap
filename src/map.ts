import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-draw/dist/leaflet.draw";

import { DIVISOR, EPOCH_LOCATION, type Location, tileServers } from "./universal";
import type { User } from "./util";
import { calcWhatPercent } from "e";
import { settings } from "./main";

const damagedUsers = new Set<string>();
export const lastUserCache = new Map<string, User>();

export const hiddenUsers = new Set(["snoopy"]);

const userMarkers = new Map<string, L.Marker<any>>();

export function updateAllUserMarkers() {
	for (const [kickUsername, marker] of Array.from(userMarkers.entries())) {
		const user = lastUserCache.get(kickUsername);
		if (user)marker.setIcon(getMarkerContent(user));
	}
}

function getMarkerContent(user: User) {
	const { kickUsername, displayName, hp, battery, flags } = user;
	const lastUser = lastUserCache.get(kickUsername);
	if (!lastUser) {
		lastUserCache.set(kickUsername, user);
	}

	const classNames = [];
	if (flags.includes(2)) classNames.push("hunter");
	if (flags.includes(5)) classNames.push("ingulag");

	const didLoseHP = lastUser?.hp && hp && lastUser.hp > hp;
	if (didLoseHP) {
		damagedUsers.add(kickUsername);
		setTimeout(() => damagedUsers.delete(kickUsername), 1000 * 10);
	}
	if (didLoseHP || damagedUsers.has(kickUsername)) {
		classNames.push("damaged");
	}

	lastUserCache.set(kickUsername, user);

	const html = `<a target="_blank" style="text-decoration:none;" href="https://kick.com/${kickUsername}">
					<div class="user-marker-inner ${classNames.join(" ")}">
						<div style="display:flex;align-content:center;">
							<div class="username">${displayName}</div>
							<br/>
						</div>
						${!settings.includes("hidelb") && hp ? `<div style="font-size:10px;" class="hp">${hp} Lives</div>` : ""}
						${!settings.includes("hidelb") &&  battery && battery >= 1 ? `<div style="font-size:10px;">${battery}% Battery</div> ` : ""}
					</div>
				</a>`;

	return L.divIcon({
		className: "user-marker",
		html: html,
	});
}

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

function interpolateColor(percentage: number): string {
	const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);
	percentage = clamp(percentage, 0, 100) / 100;

	const r = percentage < 0.5 ? 255 : Math.round(255 * (1 - (percentage - 0.5) * 2));
	const g = percentage < 0.5 ? Math.round(255 * (percentage * 2)) : 255;
	const b = 0;

	return `rgb(${r}, ${g}, ${b})`;
}

export function initLeafletMap({
	mapID,
	tileServer = tileServers.arcGIS,
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
	L.tileLayer(tileServer, {maxNativeZoom: 30, maxZoom: 19, minNativeZoom: 15,minZoom: 15}).addTo(map);

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

	function updateUserLocation({ kickUsername, displayName, flags, lat, lng, avatar, real, battery, hp, time }: User) {
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
			cached.setIcon(
				getMarkerContent({ kickUsername, displayName, flags, hp, battery, time, lat, lng, avatar, real }),
			);
		} else {
			const marker = L.marker(loc, {
				icon: getMarkerContent({
					kickUsername,
					displayName,
					flags,
					hp,
					battery,
					time,
					lat,
					lng,
					avatar,
					real,
				}),
			}).addTo(map);

			marker.on("mouseover", (ev) => {
				ev.target.openPopup();
			});

			userMarkers.set(kickUsername, marker);

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

		filterClass = "nighttime";

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
				html: `<img style="height:25px;max-height:25px; margin-left:-8px;margin-top:-6px; opacity:0.75;" src="/assets/profile_icons/water.png" />`,
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

	function updatePanel() {
		const div = document.getElementById("key")!;

		for (const [kickUsername, user] of Array.from(lastUserCache.entries())) {
			const marker = userMarkers.get(kickUsername);
			if (marker) {
				const button: HTMLDivElement = div.querySelector(`[kickname="${kickUsername}"]`) ?? document.createElement("div");
				button.setAttribute("kickname", kickUsername);
				const isHunter = user.flags.includes(2);
				const isEliminated = user.flags.includes(4);
				if (isEliminated) return;
				const inGulag = user.flags.includes(5);

				const classNames = ["userpick"];
				if (isHunter) {
					classNames.push("hunter");
				} else if (inGulag) {
					classNames.push("ingulag");
				}

				button.className = classNames.join(" ");
				let text = `<span style="font-size:12px;font-weight:bold;">${user.displayName}</span>`;
				if (!isHunter) {
					text += `<br/><span style="font-size:10px;">${user.hp ?? "??"} Lives</span>`;
				}
				if (!isHunter && !inGulag) {
					button	.style.backgroundColor = interpolateColor(calcWhatPercent(user.hp ?? 100, 100));
				}
				if (inGulag) {
					button.style.backgroundColor = "#909090";
				}
				button.innerHTML = `${text}`;
				button.onclick = () => map.setView(marker.getLatLng(), 20);
				div.appendChild(button);
			}
		}
	}

	map.on("zoomend", updatePanel);
	map.on("moveend", updatePanel);

	return {
		updateUserLocation,
		deleteUser,
		map,
		update,
	};
}