import { Readable } from "stream";
import {
	NeocitiesApi,
	NeocitiesApiFile,
	NeocitiesApiFileListEntry,
	NeocitiesApiUploadEntry,
} from "./NeocitiesApi";
import { Progress } from "../Progress";
import { Filesystem, FilesystemFile } from "../filesystem/Filesystem";

export class NeocitiesFilesystem extends Filesystem<NeocitiesFilesystemFile> {
	constructor(readonly api: NeocitiesApi) {
		super();
	}

	loadFromListing(entries: NeocitiesApiFileListEntry[]): this {
		for (const entry of entries) {
			if (entry.is_directory) continue;
			const existingFile = this.getFromPath(entry.path);

			if (existingFile) {
				existingFile.commit(entry);
			} else {
				const file = new CommittedNeocitiesFilesystemFile(
					entry,
					this.api,
				);

				file.setFilesystem(this);

				this.addFile(
					new CommittedNeocitiesFilesystemFile(entry, this.api),
				);
			}
		}

		return this;
	}

	loadFromNeocities(sitePath?: string): Progress<this> {
		return Progress.runAsync(
			"loading files from neocities' servers",
			async (progress) => {
				const entries = await progress.defer(
					this.api.fetchFileList(sitePath),
				);

				return this.loadFromListing(entries);
			},
		);
	}

	uploadNewFiles(
		files: FilesystemFile[],
		force = false,
	): Progress<CommittedNeocitiesFilesystemFile[]> {
		return Progress.runAsync(
			"creating new files on neocities",
			async (progress) => {
				const neocitiesFiles: CommittedNeocitiesFilesystemFile[] = [];
				const uploadEntries: NeocitiesApiUploadEntry[] = [];

				for (const file of files) {
					const fileEntry: NeocitiesApiFile = {
						is_directory: false,
						path: file.getWebsitePath(),
						sha1_hash: await progress.defer(file.getHash()),
						size: await progress.defer(file.getSize()),
					};

					const existingFile = this.getFromPath(fileEntry.path);

					if (existingFile && force !== true) {
						throw new Error(
							"tried to upload a new file into a NeocitiesFilesystem, but it already exists",
						);
					}

					const neocitiesFile = new CommittedNeocitiesFilesystemFile(
						fileEntry,
						this.api,
					);

					neocitiesFiles.push(neocitiesFile);

					const stream = await progress.defer(file.readAsStream());

					const uploadEntry: NeocitiesApiUploadEntry = {
						path: neocitiesFile.getWebsitePath(),
						stream,
					};

					uploadEntries.push(uploadEntry);
				}

				await progress.defer(this.api.uploadFiles(uploadEntries));

				for (const file of neocitiesFiles) {
					this.addFile(file);
				}

				return neocitiesFiles;
			},
		);
	}

	deleteFilesInBulk(files: NeocitiesFilesystemFile[]): Progress<void> {
		return Progress.runAsync(
			"deleting multiple files off neocities",
			async (progress) => {
				for (const file of files) {
					if (!this.getIfContainsFile(file)) {
						throw new Error(
							"trying to delete a file that isn't within this filesystem",
						);
					}
				}

				const paths = files.map((v) => v.getWebsitePath());

				await progress.defer(this.api.deleteFiles(paths));
			},
		);
	}

	override createUncommittedFile(
		websitePath: string,
	): PartialNeocitiesFilesystemFile {
		return new PartialNeocitiesFilesystemFile(websitePath, {}, this.api);
	}
}

export type NeocitiesFilesystemFile =
	| PartialNeocitiesFilesystemFile
	| CommittedNeocitiesFilesystemFile;

export class PartialNeocitiesFilesystemFile extends FilesystemFile {
	constructor(
		public sitePath: string,
		public entry: Partial<NeocitiesApiFile>,
		readonly api: NeocitiesApi,
	) {
		super(sitePath);
	}

	override filesystem: NeocitiesFilesystem | null = null;

	isCommitted = false;

	commit(entry: NeocitiesApiFile) {
		this.entry = entry;
		this.isCommitted = true;
		return this;
	}

	getIsComplete(): this is CommittedNeocitiesFilesystemFile {
		return this.isCommitted;
	}

	refetch(): Progress<void> {
		return Progress.runAsync(
			"refetching file details from neocities",
			async (progress) => {
				const directory =
					this.getWebsitePathDirectoryName() ?? undefined;

				this.isCommitted = false;

				if (this.filesystem) {
					await progress.defer(
						this.filesystem.loadFromNeocities(directory),
					);
				} else {
					const entries = await progress.defer(
						this.api.fetchFileList(directory),
					);

					for (const entry of entries) {
						if (
							!entry.is_directory &&
							this.doesMatchPath(entry.path)
						) {
							this.entry = entry;
						}
					}
				}
			},
		);
	}

	getHash(): Progress<string> {
		if (this.getIsComplete()) {
			return Progress.resolve(this.entry.sha1_hash);
		}

		return Progress.runAsync(
			"fetching file hash from neocities",
			async (progress) => {
				await progress.defer(this.refetch());

				return this.entry.sha1_hash!;
			},
		);
	}

	getSize(): Progress<number> {
		if (this.getIsComplete()) {
			return Progress.resolve(this.entry.size);
		}

		return Progress.runAsync(
			"fetching file size from neocities",
			async (progress) => {
				await progress.defer(this.refetch());

				return this.entry.size!;
			},
		);
	}

	protected _processDelete(): Progress<void> {
		return Progress.deferReturnVoid(
			this.api.deleteFiles([this.getWebsitePath()]),
			"deleting file off neocities",
		);
	}

	readAsBuffer(): Progress<Buffer<ArrayBufferLike | ArrayBuffer>> {
		return Progress.defer(this.api.downloadFile(this.getWebsitePath()));
	}

	protected _uploadToNeocities(data: Buffer | Readable): Progress<void> {
		return Progress.runAsync("uploading to neocities", async (progress) => {
			let stream: Readable;

			if (Buffer.isBuffer(data)) {
				stream = Readable.from(data);
			} else {
				stream = data;
			}

			await progress.defer(
				this.api.uploadFiles([
					{
						path: this.getWebsitePath(),
						stream,
					},
				]),
			);
		});
	}

	overwrite(data: Buffer | Readable): Progress<void> {
		return Progress.runAsync("uploading to neocities", async (progress) => {
			if (!this.getIsComplete()) {
				throw new Error(
					"cannot overwrite file on neocities because it's not confirmed that it exists",
				);
			}

			await progress.defer(this._uploadToNeocities(data));
		});
	}

	initiallyWrite(data: Buffer | Readable): Progress<void> {
		return Progress.runAsync("creating new file", async (progress) => {
			if (this.getIsComplete()) {
				throw new Error(
					"cannot create file on neocities because it already exists",
				);
			}

			await progress.defer(this.overwrite(data));
		});
	}

	toString() {
		return `[NeocitiesFile ${this.getWebsitePath()}]`;
	}
}

export class CommittedNeocitiesFilesystemFile extends PartialNeocitiesFilesystemFile {
	constructor(public override entry: NeocitiesApiFile, api: NeocitiesApi) {
		super(entry.path, entry, api);
	}

	isCommitted: boolean = true;
}
