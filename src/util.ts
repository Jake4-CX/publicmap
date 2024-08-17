const charMap: any = {
	a: "m",
	b: "n",
	c: "o",
	d: "p",
	e: "q",
	f: "r",
	g: "s",
	h: "t",
	i: "u",
	j: "v",
	k: "w",
	l: "x",
	m: "y",
	n: "z",
	o: "a",
	p: "b",
	q: "c",
	r: "d",
	s: "e",
	t: "f",
	u: "g",
	v: "h",
	w: "i",
	x: "j",
	y: "k",
	z: "l",
	"0": "5",
	"1": "6",
	"2": "7",
	"3": "8",
	"4": "9",
	"5": "0",
	"6": "1",
	"7": "2",
	"8": "3",
	"9": "4",
	A: "N",
	B: "O",
	C: "P",
	D: "Q",
	E: "R",
	F: "S",
	G: "T",
	H: "U",
	I: "V",
	J: "W",
	K: "X",
	L: "Y",
	M: "Z",
	N: "A",
	O: "B",
	P: "C",
	Q: "D",
	R: "E",
	S: "F",
	T: "G",
	U: "H",
	V: "I",
	W: "J",
	X: "K",
	Y: "L",
	Z: "M",
};

function isCommand(str: string) {
	return str === "DISABLE" || str.startsWith("HIDE:");
}

export type SettingsArray = ["S", boolean, boolean, number, number, number];
export type UserArray = [string, string | 0, number[], number, number, string | 0, number, number, string | 0];
export type WebsocketMessage = string | (UserArray | SettingsArray)[];

export function decode(encodedData: Uint8Array, decompressor: (buf: Uint8Array) => Uint8Array): WebsocketMessage {
	const raw = new TextDecoder().decode(decompressor(encodedData));
	if (isCommand(raw)) {
		return raw;
	}
	const decodedData: UserArray = JSON.parse(raw);

	return decodedData.map((item, index) => {
		if (typeof item === "string") {
			return item.replace(/./g, (char) => Object.keys(charMap).find((key) => charMap[key] === char) || char);
		}
		if (Array.isArray(item)) {
			return item.map((subItem: any) => {
				if (typeof subItem === "string") {
					return subItem.replace(
						/./g,
						(char) => Object.keys(charMap).find((key) => charMap[key] === char) || char,
					);
				}
				if (typeof subItem === "number") {
					return subItem - 25 * index;
				}
				if (Array.isArray(subItem)) {
					return subItem.map((number) => number - 25 * index);
				}
				return subItem;
			});
		}
	}) as WebsocketMessage;
}

export function formatDuration(ms: number, short = false, precise = false) {
	if (ms < 0) ms = -ms;
	const time = {
		day: Math.floor(ms / 86_400_000),
		hour: Math.floor(ms / 3_600_000) % 24,
	};
	const shortTime = {
		d: Math.floor(ms / 86_400_000),
		h: Math.floor(ms / 3_600_000) % 24,
		m: Math.floor(ms / 60_000) % 60,
		s: Math.floor(ms / 1000) % 60,
	};
	const nums = Object.entries(short ? shortTime : time).filter((val) => val[1] !== 0);
	if (nums.length === 0) {
		return precise ? `${ms}ms` : "less than 1 second";
	}
	return nums
		.map(([key, val]) => `${val}${short ? "" : " "}${key}${val === 1 || short ? "" : "s"}`)
		.join(short ? "" : ", ");
}

export type User = {
	kickUsername: string;
	displayName: string | null;
	flags: number[];
	lat: number;
	lng: number;
	avatar?: string | null;
	real: boolean;
	battery?: number;
	hp?: number;
	time?: string;
};
