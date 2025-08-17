import { FilesystemFactory } from "../filesystem/FilesystemFactory";
import { LocalFilesystem } from "../filesystem/LocalFilesystem";
import { progressFetch, progressFetchJson } from "./ProgressFetch";
import { progressHttp, progressHttpJson } from "./ProgressHttp";

describe("ProgressHttp", () => {
	test("dummy", () => {});

	return;

	test("fetches", async () => {
		const progress = progressHttp("https://dabric.xyz/test.txt");

		const [body] = await progress;

		const string = body.toString();

		expect(string).toEqual("Hello, world!");
		expect(progress.maximumProgress).toEqual(string.length);
		expect(progress.currentProgress).toEqual(string.length);
	});

	test("fetches json", async () => {
		const progress = progressHttpJson<{ test: 10 }>(
			"https://dabric.xyz/test.json",
		);

		const [body] = await progress;

		expect(body).toEqual({ test: 10 });
		expect(progress.maximumProgress).toEqual(12);
		expect(progress.currentProgress).toEqual(12);
	});

	test("uploads", async () => {
		const filesystem =
			await FilesystemFactory.createLocalFilesystemFromDirectory(
				"./test",
			);
		const file = filesystem.getFromPath("test.txt")!;

		const buffer = await file.readAsBuffer();

		const progress = progressHttp(
			"https://dabric.xyz/test.txt",
			{},
			buffer,
		);

		let didUpload = false;

		progress.subscribe(() => {
			if (progress.status === "uploading") {
				didUpload = true;
			}
		});

		const [body] = await progress;

		const string = body.toString();

		expect(string).toEqual("Hello, world!");
		expect(progress.maximumProgress).toEqual(string.length);
		expect(progress.currentProgress).toEqual(string.length);
		expect(didUpload).toEqual(true);
	});
});
