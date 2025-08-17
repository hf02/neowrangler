import { Progress } from "../Progress";
import { Filesystem, FilesystemFile } from "./Filesystem";

class TestFilesystemFile extends FilesystemFile {
	override readAsBuffer(): Progress<Buffer<ArrayBufferLike | ArrayBuffer>> {
		return Progress.runAsync("return whatever", async () => {
			return Buffer.from("Hello, world!");
		});
	}
}

const createFile = (path: string) => new TestFilesystemFile(path);

describe("FilesystemFile", () => {
	test("reads file extensions", async () => {
		expect(createFile("index.html").getFileExtension()).toEqual("html");

		expect(createFile("audio.mp3").getFileExtension()).toEqual("mp3");

		expect(createFile("no-extension").getFileExtension()).toEqual("");

		expect(createFile("nested/file.png").getFileExtension()).toEqual("png");
	});

	test("distinguishes files supported on a free account", async () => {
		expect(createFile("index.html").getIsSupportedOnFree()).toEqual(true);

		expect(createFile("no-extension").getIsSupportedOnFree()).toEqual(true);

		expect(createFile("audio.mp3").getIsSupportedOnFree()).toEqual(false);
	});

	test("gets website path", async () => {
		expect(createFile("index.html").getWebsitePath()).toEqual("index.html");
		expect(createFile("/index.html").getWebsitePath()).toEqual(
			"index.html",
		);

		expect(createFile("nested/index.html").getWebsitePath()).toEqual(
			"nested/index.html",
		);
		expect(createFile("/nested/index.html").getWebsitePath()).toEqual(
			"nested/index.html",
		);
	});

	test("reads string from buffer", async () => {
		expect(await createFile("index.html").readAsString()).toEqual(
			"Hello, world!",
		);
	});
});

class TestFilesystem extends Filesystem<TestFilesystemFile> {}

describe("Filesystem", () => {
	test("finds files", () => {
		const filesystem = new TestFilesystem();

		filesystem.addFile(createFile("test.txt"));
		filesystem.addFile(createFile("nested/test.txt"));

		expect(filesystem.getFromPath("test.txt")).not.toBeNull();
		expect(filesystem.getFromPath("nested/test.txt")).not.toBeNull();
		expect(filesystem.getFromPath("does-not-exist")).toBeNull();
	});

	test("adds files, replacing any duplicates", () => {
		const filesystem = new TestFilesystem();

		filesystem.addFile(createFile("test1.txt"));
		filesystem.addFile(createFile("test2.txt"));
		filesystem.addFile(createFile("nested/test.txt"));
		filesystem.addFile(createFile("nested/test.txt"));
		filesystem.addFile(createFile("test1.txt"));
		filesystem.addFile(createFile("test2.txt"));
		filesystem.addFile(createFile("test3.txt"));

		const getFindCount = (path: string) => {
			let count = 0;
			for (const file of filesystem.files) {
				if (file.doesMatchPath(path)) {
					count++;
				}
			}

			return count;
		};

		expect(getFindCount("test1.txt")).toEqual(1);
		expect(getFindCount("test2.txt")).toEqual(1);
		expect(getFindCount("test3.txt")).toEqual(1);
		expect(getFindCount("nested/test.txt")).toEqual(1);
		expect(getFindCount("does-not-exist")).toEqual(0);
	});
});
