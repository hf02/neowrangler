import { NeocitiesApi } from "./NeocitiesApi.js";
import { FilesystemFactory } from "../filesystem/FilesystemFactory.js";
import { NeocitiesFilesystem } from "./NeocitiesFilesystem.js";

import "dotenv/config";
import { neowranglerTestApiKey } from "../consts.js";

describe("NeocitiesFilesystem", () => {
	test("dummy", () => {});

	return;

	test("yeah", async () => {
		const api = new NeocitiesApi();
		await api.login(process.env[neowranglerTestApiKey]!);

		const filesystem = new NeocitiesFilesystem(api);
		await filesystem.loadFromNeocities();

		expect(filesystem.getFromPath("index.html")).not.toBeNull();

		const localFilesystem =
			await FilesystemFactory.createLocalFilesystemFromDirectory(
				"./test",
			);

		const test = localFilesystem.getFromPath("test.txt")!;

		const test2 = test?.cloneAsWebsitePath("test2.txt");

		const [neoTest, neoTest2] = await filesystem.uploadNewFiles([
			test,
			test2,
		]);

		expect(neoTest).not.toBeNull();
		expect(neoTest2).not.toBeNull();

		if (!neoTest || !neoTest2) {
			return;
		}

		let existingError;

		try {
			await filesystem.uploadNewFiles([test, test2]);
		} catch (error) {
			existingError = error;
		}

		expect(existingError).not.toBeNull();

		const neoTestContents = await neoTest.readAsString();

		expect(neoTestContents).toEqual("Hello, world!");

		await neoTest.delete();
		await neoTest2.delete();
	});
});
