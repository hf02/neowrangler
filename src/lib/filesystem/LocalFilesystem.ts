import path from "node:path";
import { Progress } from "../Progress.js";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import { Filesystem, FilesystemFile } from "./Filesystem.js";
import { doesErrorMatchNodeCode } from "../node/error.js";
import Stream, { Readable } from "node:stream";

export function traverseDirectory(
	directory: string,
	root = "/",
): Progress<string[]> {
	return Progress.runAsync("", async (progress) => {
		progress.setUnit("files");
		const foundFiles: string[] = [];

		const paths = await fs.readdir(directory);

		for (let i = 0; i < paths.length; i++) {
			progress.currentProgress++;
			const filePath = paths[i]!;
			const location = path.join(directory, filePath);
			const siteLocation = path.posix.join(root, filePath);
			const fileStat = await fs.stat(location);

			if (fileStat.isDirectory()) {
				const filesFoundInFolder = await progress.addChild(
					traverseDirectory(location, siteLocation),
				);

				foundFiles.push(...filesFoundInFolder);
			} else {
				foundFiles.push(siteLocation);
			}
		}

		return foundFiles;
	});
}

export class LocalFilesystem<
	T extends LocalFilesystemFile = LocalFilesystemFile,
> extends Filesystem<T> {
	readonly root: string;

	constructor(relativeSystemPath: string) {
		super();

		const pwd = LocalFilesystem.getPresentWorkingDirectory();
		this.root = path.resolve(pwd, relativeSystemPath);
	}

	static getPresentWorkingDirectory() {
		return path.resolve(".");
	}

	loadFromDirectory<
		This extends LocalFilesystem<InstanceType<F>>,
		F extends typeof LocalFilesystemFile,
	>(this: This, File: InstanceType<F> extends T ? F : never): Progress<This> {
		return Progress.runAsync("reading directory", async (progress) => {
			const root = this.root;

			const siteFilePaths = await progress.defer(traverseDirectory(root));

			for (const siteFilePath of siteFilePaths) {
				const systemFilePath = path.join(root, siteFilePath);

				File.createAndAddEmptyToFilesystem<F>(
					siteFilePath,
					systemFilePath,
					this,
				);
			}

			return this;
		});
	}

	override createUncommittedFile(websitePath: string): LocalFilesystemFile {
		const { normalizedWebsitePath, systemPath } =
			this.getWebsiteAndSystemPath(websitePath);

		return new LocalFilesystemFile(normalizedWebsitePath, systemPath);
	}

	getWebsiteAndSystemPath(websitePath: string): {
		normalizedWebsitePath: string;
		systemPath: string;
	} {
		const root = this.root;

		const normalizedWebsitePath = path.posix.normalize(websitePath);

		const systemPath = path.join(root, normalizedWebsitePath);

		return { normalizedWebsitePath, systemPath };
	}
}

export class LocalFilesystemFile extends FilesystemFile {
	constructor(websitePath: string, protected systemPath: string) {
		super(websitePath);
	}

	getSystemPath() {
		return this.systemPath;
	}

	protected _cachedHash: string | null = null;
	override getHash(): Progress<string> {
		return Progress.runAsync(
			"getting hash of file on disk",
			async (progress) => {
				if (this._cachedHash) {
					return this._cachedHash;
				}

				const buffer = await progress.defer(this.readAsBuffer());

				const shasum = crypto.createHash("sha1");
				shasum.update(buffer);
				const hash = shasum.digest("hex");

				this._cachedHash = hash;

				return hash;
			},
		);
	}

	protected _cachedFileSize: number | null = null;
	override getSize(): Progress<number> {
		return Progress.runAsync(
			"getting size of file on disk",
			async (progress) => {
				if (this._cachedFileSize) {
					return this._cachedFileSize;
				}

				const path = this.getSystemPath();

				const stat = await fs.stat(path);

				const size = stat.size;

				this._cachedFileSize = size;

				return size;
			},
		);
	}

	override readAsBuffer(): Progress<Buffer<ArrayBufferLike>> {
		return Progress.runAsync(
			"reading file on disk as binary",
			async (progress) => {
				return await fs.readFile(this.getSystemPath());
			},
		);
	}

	protected _writeFile(data: Buffer | Readable): Progress<void> {
		return Progress.runAsync("writing file to disk", async (progress) => {
			const path = this.getSystemPath();

			await fs.writeFile(path, data);
		});
	}

	override initiallyWrite(data: Buffer | Readable): Progress<void> {
		return Progress.runAsync("creating file on disk", async (progress) => {
			const path = this.getSystemPath();

			try {
				await fs.stat(path);

				throw new Error(
					"cannot create a file on disk because it already exists.",
				);
			} catch (error) {
				if (!doesErrorMatchNodeCode(error, "ENOENT")) {
					throw error;
				}
			}

			await this._writeFile(data);
		});
	}

	protected override _processDelete(): Progress<void> {
		throw new LocalFilesystemReadOnlyError(
			"LocalFilesystemFile cannot delete files",
		);
	}

	override overwrite(data: Buffer | Stream): Progress<void> {
		throw new LocalFilesystemReadOnlyError(
			"LocalFilesystemFile cannot overwrite files",
		);
	}

	override readAsStream(): Progress<Readable> {
		return Progress.resolve<Readable>(
			createReadStream(this.getSystemPath()),
		);
	}

	readAsBlob(): Progress<Blob> {
		return Progress.runAsync("reading file as blob", async (progress) => {
			return await fsSync.openAsBlob(this.getSystemPath());
		});
	}

	clone(): LocalFilesystemFile {
		const file = new LocalFilesystemFile(this.websitePath, this.systemPath);

		file._cachedFileSize = this._cachedFileSize;
		file._cachedHash = this._cachedHash;

		return file;
	}

	cloneAsWebsitePath(websitePath: string): LocalFilesystemFile {
		const clone = this.clone();
		clone.websitePath = websitePath;

		return clone;
	}

	static createAndAddEmptyToFilesystem<T extends typeof LocalFilesystemFile>(
		this: T,
		websitePath: string,
		systemPath: string,
		filesystem: LocalFilesystem<InstanceType<T>>,
	): InstanceType<T> {
		const file = new this(websitePath, systemPath).setFilesystem(
			filesystem,
		);

		filesystem.addFile(file as InstanceType<T>);

		return file as InstanceType<T>;
	}

	static createAndAddEmptyToFilesystemFromWebsitePath<
		T extends typeof LocalFilesystemFile,
	>(
		this: T,
		websitePath: string,
		filesystem: LocalFilesystem<InstanceType<T>>,
	): InstanceType<T> {
		const { normalizedWebsitePath, systemPath } =
			filesystem.getWebsiteAndSystemPath(websitePath);

		return this.createAndAddEmptyToFilesystem(
			normalizedWebsitePath,
			systemPath,
			filesystem,
		);
	}

	static writeNewFileToFilesystem<T extends typeof LocalFilesystemFile>(
		this: T,
		filesystem: LocalFilesystem<InstanceType<T>>,
		websitePath: string,
		data: Buffer | Readable,
	): Progress<InstanceType<T>> {
		return Progress.runAsync("creating new file", async (progress) => {
			const file = this.createAndAddEmptyToFilesystemFromWebsitePath(
				websitePath,
				filesystem,
			);

			await progress.defer(file.initiallyWrite(data));

			return file as InstanceType<T>;
		});
	}

	toString() {
		return `[Local File ${this.getSystemPath()}]`;
	}
}

export class LocalFilesystemReadOnlyError extends Error {}
