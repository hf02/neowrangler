import { NeocitiesApi } from "./NeocitiesApi.js";
import { FilesystemFactory } from "../filesystem/FilesystemFactory.js";
import { neowranglerTestApiKey } from "../consts.js";
import "dotenv/config";

describe("NeocitiesApi", () => {
	test("dummy", () => {});

	return;

	test("yeah", async () => {
		const neocities = new NeocitiesApi();
		await neocities.login(process.env[neowranglerTestApiKey]!);

		const siteInfo = await neocities.fetchSiteInfo();

		const fileList = await neocities.fetchFileList("index.html");

		const indexHtmlBody = await neocities.downloadFile("index.html");

		const localFilesystem =
			await FilesystemFactory.createLocalFilesystemFromDirectory(
				"./test",
			);

		const test = localFilesystem.getFromPath("test.txt")!;

		const uploadResult = await neocities.uploadFiles([
			{
				path: "test.txt",
				stream: await test.readAsStream(),
			},
			{
				path: "test2.txt",
				stream: await test.readAsStream(),
			},
		]);

		const deleteResult = await neocities.deleteFiles([
			"test.txt",
			"test2.txt",
		]);

		console.log("site info: ", siteInfo);
		console.log("file list: ", fileList.map((v) => v.path).join(", "));
		console.log(
			"html body: ",
			indexHtmlBody.toString().replaceAll("\n", "").substring(0, 100),
		);
		console.log("upload result: ", uploadResult);
		console.log("delete result: ", deleteResult);
	});
});
