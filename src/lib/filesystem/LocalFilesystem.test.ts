import { FilesystemFactory } from "./FilesystemFactory.js";
import {
	LocalFilesystem,
	LocalFilesystemFile,
	LocalFilesystemReadOnlyError,
} from "./LocalFilesystem.js";

const createFilesystem = () =>
	FilesystemFactory.createLocalFilesystemFromDirectory("./test");

const testTxtContent = "Hello, world!";

describe("LocalFilesystem", () => {
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

const getTestTextFile = async () => {
	const system = await createFilesystem();
	return system.getFromPath("test.txt")!;
};

const getAudioFile = async () => {
	const system = await createFilesystem();
	return system.getFromPath("sounds/audio.mp3")!;
};

const getBlankFile = async () => {
	const system = await createFilesystem();
	return system.getFromPath("blank.txt")!;
};

const getReadOnlyTestFile = async () => {
	const system = await createFilesystem();
	return system.getFromPath("operation-tests/does-not-destroy-data.txt")!;
};

describe("LocalFilesystemFile", () => {
	test("reads file", async () => {
		const file = await getTestTextFile();

		expect(await file.readAsString()).toEqual("Hello, world!");
	});

	test("does not create file when it already exists", async () => {
		const system = await createFilesystem();

		let thrownError;

		try {
			await LocalFilesystemFile.writeNewFileToFilesystem(
				system,
				"operation-tests/already-exists.txt",
				Buffer.from(testTxtContent),
			);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeTruthy();
	});

	test("does not delete files", async () => {
		const file = await getReadOnlyTestFile();

		let thrownError;

		try {
			file.delete();
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(LocalFilesystemReadOnlyError);
	});

	test("does not overwrite files", async () => {
		const file = await getReadOnlyTestFile();

		let thrownError;

		try {
			file.overwrite(Buffer.from(""));
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(LocalFilesystemReadOnlyError);
	});

	test("gets size of file", async () => {
		const testFile = await getTestTextFile();
		const blankFile = await getBlankFile();

		expect(await testFile.getSize()).toEqual(13);
		expect(await blankFile.getSize()).toEqual(0);
	});

	test("gets system path", async () => {
		const testFile = await getTestTextFile();
		const blankFile = await getBlankFile();

		// hashes computed by neocities for those files
		expect(await testFile.getHash()).toEqual(
			"943a702d06f34599aee1f8da8ef9f7296031d699",
		);
		expect(await blankFile.getHash()).toEqual(
			"da39a3ee5e6b4b0d3255bfef95601890afd80709",
		);
	});
});
