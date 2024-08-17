export const tileServers = {
	googleSatellite: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
	googleHybrid: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
	arcGIS: "https://services.arcgisonline.com/ArcGis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}.png",
	osm: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
} as const;

export enum Flag {
	Contestant = "Contestant",
	Hunter = "Hunter",
	HiddenFromMap = "HiddenFromMap",
	Eliminated = "Eliminated",
	InGulagCurrently = "InGulagCurrently",
	OutOfGulag = "OutOfGulag",
}

export const FlagIDMap: Record<Flag, number> = {
	[Flag.Contestant]: 1,
	[Flag.Hunter]: 2,
	[Flag.HiddenFromMap]: 3,
	[Flag.Eliminated]: 4,
	[Flag.InGulagCurrently]: 5,
	[Flag.OutOfGulag]: 6,
};

export interface Location {
	latitude: number;
	longitude: number;
}

const reducePrecision = (value: number, precision = 6): number => {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
};

export const reduceLatLngAccuracy = ({ latitude, longitude }: Location): Location => {
	return {
		latitude: reducePrecision(latitude),
		longitude: reducePrecision(longitude),
	};
};

export const EPOCH_LOCATION: Location = reduceLatLngAccuracy({
	latitude: 28.48294818572977,
	longitude: -97.7688713596665,
});

export const getTotalRanchPolygon = () => {
	return [
		[28.489291, -97.778188],
		[28.486608, -97.777426],
		[28.478838, -97.773392],
		[28.474349, -97.771055],
		[28.473971, -97.768223],
		[28.480045, -97.766378],
		[28.480271, -97.762901],
		[28.481026, -97.760284],
		[28.481403, -97.757451],
		[28.481214, -97.756636],
		[28.481403, -97.755735],
		[28.482497, -97.756593],
		[28.486193, -97.755906],
		[28.489437, -97.755992],
		[28.489292, -97.778183],
	].map(([latitude, longitude]) => ({ latitude, longitude }));
};
export const DIVISOR = 6000000;
