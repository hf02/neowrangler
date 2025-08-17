import path from "node:path";
import { freeFileTypes } from "../consts.js";
import { Progress } from "../Progress.js";
import { Readable } from "node:stream";
import { FileIgnoreFilter } from "../ignore/FileIgnoreFilter.js";

export abstract class Filesystem<T extends FilesystemFile> {
	files: T[] = [];

	getFromPath(path: string): T | null {
		for (const file of this.files) {
			if (file.doesMatchPath(path)) {
				return file;
			}
		}

		return null;
	}

	getIfContainsFile(fileToCheck: T): boolean {
		for (const file of this.files) {
			if (file === fileToCheck) {
				return true;
			}
		}

		return false;
	}

	addFile(fileToAdd: T): this {
		for (let i = this.files.length - 1; i >= 0; i--) {
			const existingFile = this.files[i]!;

			if (existingFile.doesMatchPath(fileToAdd.getWebsitePath())) {
				this.files.splice(i, 1);
			}
		}

		this.files.push(fileToAdd);
		return this;
	}

	createUncommittedFile(websitePath: string): FilesystemFile {
		return new DummyFilesystemFile(websitePath).setFilesystem(this);
	}

	removeFile(file: T): this {
		for (let i = this.files.length - 1; i >= 0; i--) {
			const existingFile = this.files[i]!;

			if (existingFile.doesMatchPath(file.getWebsitePath())) {
				this.files.splice(i, 1);
			}
		}

		return this;
	}

	protected _cloneVanillaFilesystemTo<T extends Filesystem<any>>(
		filesystemTo: T,
	): T {
		filesystemTo.files = [];

		for (const file of this.files) {
			const clonedFile = file.clone();

			filesystemTo.addFile(clonedFile);
		}

		return filesystemTo;
	}

	clone(): Filesystem<T> {
		return this._cloneVanillaFilesystemTo(
			new DummyFilesystem() as Filesystem<T>,
		);
	}

	filter(fileIgnoreFilter: FileIgnoreFilter): this {
		const filtered = this.files.filter((file) =>
			fileIgnoreFilter.getIfAcceptsFile(file),
		);

		this.files = filtered;

		return this;
	}
}

export abstract class FilesystemFile {
	constructor(protected websitePath: string) {}

	filesystem: Filesystem<FilesystemFile> | null = null;
	setFilesystem(filesystem: Exclude<typeof this.filesystem, null>): this {
		this.filesystem = filesystem;
		return this;
	}

	/**
	 * ex: `index.html`, `images/cat.png`
	 */
	getWebsitePath(): string {
		if (this.websitePath[0] === "/") {
			return this.websitePath.substring(1);
		} else {
			return this.websitePath;
		}
	}

	getWebsitePathDirectoryName(): string | null {
		const directoryName = path.dirname(this.getWebsitePath());

		if (directoryName === ".") {
			return null;
		}

		return directoryName;
	}

	getFileName(): string {
		return path.basename(this.getWebsitePath());
	}

	getFileExtension(): string {
		const extname = path.extname(this.getWebsitePath());

		if (extname.startsWith(".")) {
			return extname.substring(1);
		}

		return extname;
	}

	getIsSupportedOnFree(): boolean {
		const extension = this.getFileExtension();

		if (extension === "") return true;

		return freeFileTypes.includes(extension);
	}

	doesMatchPath(path: string): boolean {
		return path === this.getWebsitePath();
	}

	getHash(): Progress<string> {
		throw new Error("unimplemented");
	}

	getSize(): Progress<number> {
		throw new Error("unimplemented");
	}

	readAsBuffer(): Progress<Buffer<ArrayBufferLike | ArrayBuffer>> {
		throw new Error("unimplemented");
	}

	protected _processDelete(): Progress<void> {
		throw new Error("unimplemented");
	}

	delete(): Progress<void> {
		if (this.filesystem) {
			this.filesystem.removeFile(this);
		}

		return this._processDelete();
	}

	readAsString(): Progress<string> {
		return Progress.runAsync("reading file as utf-8", async (progress) => {
			const arrayProgress = this.readAsBuffer();

			const array = await progress.defer(arrayProgress);

			return array.toString("utf-8");
		});
	}

	readAsStream(): Progress<Readable> {
		return Progress.runAsync(
			"creating stream for file from buffer",
			async (progress) => {
				const buffer = await this.readAsBuffer();

				return Readable.from(buffer);
			},
		);
	}

	overwrite(data: Buffer | Readable): Progress<void> {
		throw new Error("unimplemented");
	}

	initiallyWrite(data: Buffer | Readable): Progress<void> {
		throw new Error("unimplemented");
	}

	clone(): FilesystemFile {
		return new DummyFilesystemFile(this.websitePath);
	}

	toString() {
		return `[File ${this.getWebsitePath()}]`;
	}
}

// export abstract class LocalFilesystemFile extends FilesystemFile {
// 	constructor(
// 		websitePath: string,
// 		protected readonly absoluteFilesystemPath: string,
// 	) {
// 		super(websitePath);
// 	}

// 	getLocalFilesystemPath() {
// 		return this.absoluteFilesystemPath;
// 	}

// 	protected _cachedHash: string | null = null;
// 	override getHash(): Progress<string> {
// 		return Progress.runAsync("getting hash of file", async (progress) => {
// 			if (this._cachedHash) {
// 				return this._cachedHash;
// 			}

// 			const buffer = await progress.defer(this.readAsBuffer());

// 			const shasum = crypto.createHash("sha1");
// 			shasum.update(buffer);
// 			const hash = shasum.digest("hex");

// 			this._cachedHash = hash;

// 			return hash;
// 		});
// 	}

// 	protected _cachedFileSize: number | null = null;
// 	override getSize(): Progress<number> {
// 		return Progress.runAsync("getting size of file", async (progress) => {
// 			if (this._cachedFileSize) {
// 				return this._cachedFileSize;
// 			}

// 			const array = await progress.defer(this.readAsBuffer());

// 			const size = array.byteLength;

// 			this._cachedFileSize = size;

// 			return size;
// 		});
// 	}

// 	override readAsBuffer(): Progress<Buffer<ArrayBufferLike>> {
// 		return Progress.runAsync("reading file as binary", async (progress) => {
// 			return await readFile(this.getLocalFilesystemPath());
// 		});
// 	}
// }

export class DummyFilesystem extends Filesystem<DummyFilesystemFile> {}
export class DummyFilesystemFile extends FilesystemFile {}
