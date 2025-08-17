import { ByteProgressUnit, Progress } from "../Progress";

export function getLengthOfBodyInit(
	init?: BodyInit | FormDataEntryValue,
): number {
	if (!init) {
		return 0;
	}

	if (init instanceof ReadableStream) {
		return 0;
	}

	if (init instanceof Blob) {
		return init.size;
	}

	if (typeof init === "string") {
		return init.length;
	}

	if (init instanceof FormData) {
		let size = 0;
		for (const [key, value] of init) {
			size += getLengthOfBodyInit(value);
		}

		return size;
	}

	if (init instanceof URLSearchParams) {
		return init.toString().length;
	}

	return init.byteLength;
}

export function progressFetch(
	input: string | URL | Request,
	init?: RequestInit,
): Progress<[Buffer, Response]> {
	return Progress.runAsync("fetching body", async (progress) => {
		progress.setUnit(new ByteProgressUnit());
		const response = await fetch(input, init);

		const length = parseInt(response.headers.get("content-length") ?? "");

		const values: Uint8Array[] = [];

		if (!isNaN(length)) {
			progress.maximumProgress = length;
		}

		if (!response.body) {
			throw new Error("no body from response");
		}

		const reader = response.body.getReader();
		let finalLength = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			values.push(value);
			finalLength += value.length;
			progress.currentProgress += value.byteLength;
		}

		const array = new Uint8Array(finalLength);

		let offset = 0;
		for (const value of values) {
			array.set(value, offset);
			offset += value.length;
		}

		return [Buffer.from(array), response];
	});
}

export function progressFetchJson<T = any>(
	...args: Parameters<typeof progressFetch>
): Progress<[T, Response]> {
	return Progress.runAsync("fetching body as json", async (progress) => {
		progress.setUnit("bytes");
		const [body, response] = await progress.defer(progressFetch(...args));

		const string = body.toString();
		const json: T = JSON.parse(string);

		return [json, response];
	});
}
