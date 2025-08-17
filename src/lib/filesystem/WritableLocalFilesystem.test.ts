import { doesErrorMatchNodeCode } from "../node/error";
import { FilesystemFactory } from "./FilesystemFactory";
import {
	LocalFilesystem,
	LocalFilesystemFile,
	LocalFilesystemReadOnlyError,
} from "./LocalFilesystem";
import {
	WritableLocalFilesystem,
	WritableLocalFilesystemFile,
} from "./WritableLocalFilesystem";

const createFilesystem = () =>
	FilesystemFactory.createWritableLocalFilesystemFromDirectory("./test");

const testTxtContent = "Hello, world!";

describe("WritableLocalFilesystem", () => {
	test("creates filesystem", async () => {
		await createFilesystem();
	});

	test("reads directory and gets files", async () => {
		const system = await createFilesystem();

		expect(system.getFromPath("index.html")).not.toBeNull();
		expect(system.getFromPath("test.txt")).not.toBeNull();
		expect(system.getFromPath("blank.txt")).not.toBeNull();
		expect(system.getFromPath("images/cat.png")).not.toBeNull();
		expect(system.getFromPath("sounds/audio.mp3")).not.toBeNull();
		expect(system.getFromPath("images/doesnotexist.png")).toBeNull();
	});
});

describe("WritableLocalFilesystemFile", () => {
	test("creates and deletes files", async () => {
		const system = await createFilesystem();

		const file = await WritableLocalFilesystemFile.writeNewFileToFilesystem(
			system,
			"operation-tests/delete-test.txt",
			Buffer.from(testTxtContent),
		);

		expect(await file.readAsString()).toEqual(testTxtContent);

		await file.delete();

		let caughtError;

		try {
			await file.readAsString();
		} catch (error) {
			caughtError = error;
		}

		expect(doesErrorMatchNodeCode(caughtError, "ENOENT")).toEqual(true);
	});

	test("overwrites files", async () => {
		const system = await createFilesystem();

		const file =
			WritableLocalFilesystemFile.createAndAddEmptyToFilesystemFromWebsitePath(
				"operation-tests/overwrite-test.txt",
				system,
			);

		await file.overwrite(Buffer.from("test 1"));

		expect(await file.readAsString()).toEqual("test 1");

		await file.overwrite(Buffer.from("test 2"));

		expect(await file.readAsString()).toEqual("test 2");
	});
});
