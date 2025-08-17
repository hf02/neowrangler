import { progressFetch, progressFetchJson } from "./ProgressFetch";

describe("ProgressFetch", () => {
	test("progressFetch fetches data: urls", async () => {
		const progress = progressFetch("data:,Hello%2C%20world%21");

		const [body] = await progress;

		const string = body.toString();

		expect(string).toEqual("Hello, world!");
		expect(progress.totalMaximumProgress).toEqual(0);
		expect(progress.totalCurrentProgress).toEqual(string.length);
	});

	test("progressFetchJson fetches data: urls", async () => {
		const [body] = await progressFetchJson<{ test: 10 }>(
			"data:,%7B%22test%22:%2010%7D",
		);

		expect(body).toEqual({ test: 10 });
	});
});
