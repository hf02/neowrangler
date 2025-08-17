import { Filesystem, FilesystemFile } from "../filesystem/Filesystem";
import {
	NeocitiesFilesystem,
	NeocitiesFilesystemFile,
	PartialNeocitiesFilesystemFile,
} from "../neocities/NeocitiesFilesystem";
import { Progress } from "../Progress";

/**
 * determines the order
 */
export enum SyncActionTag {
	Unknown = -1,

	AssetDeletion = 0,
	HtmlDeletion = 1,

	AssetUpload = 2,
	HtmlUpload = 3,

	AssetOverwrite = 4,
	HtmlOverwrite = 5,

	IndexHtml = 6,
}

export interface SyncAction {
	progress: Progress;

	run(): Progress<void>;

	predictProgress?(): Progress<void>;

	attemptToMerge?(action: SyncAction): boolean;

	getTag?(): SyncActionTag | null;

	toVerboseString(): string;
}

export class DeleteSyncAction implements SyncAction {
	constructor(readonly toDelete: FilesystemFile) {}

	progress = new Progress("deleting");

	run() {
		return Progress.deferReturnVoid(this.toDelete.delete());
	}

	toVerboseString(): string {
		return `Delete: ${this.toDelete.toString()}`;
	}
}

export class BulkNeocitiesUploadSyncAction implements SyncAction {
	constructor(
		readonly filesystem: NeocitiesFilesystem,
		public toUpload: FilesystemFile[],
		public batchSize = 20,
		public force = false,
	) {}

	progress = new Progress("uploading");

	predictProgress(): Progress<void> {
		return Progress.runAsync(
			"computing upload length",
			async (progress) => {
				this.progress.maximumProgress = 0;
				for (const file of this.toUpload) {
					const size = await progress.defer(file.getSize());
					this.progress.maximumProgress += size;
				}
			},
		);
	}

	run() {
		return this.progress.hookToFunction(async (progress) => {
			await progress.defer(
				this.filesystem.uploadNewFiles(this.toUpload, this.force),
			);
		});
	}

	attemptToMerge(action: SyncAction): boolean {
		if (
			!(action instanceof BulkNeocitiesUploadSyncAction) ||
			action.force !== this.force
		) {
			return false;
		}

		if (this.toUpload.length + action.toUpload.length > this.batchSize) {
			return false;
		}

		this.toUpload.push(...action.toUpload);

		return true;
	}

	getTag(): SyncActionTag {
		if (this.toUpload.length !== 1) return SyncActionTag.Unknown;

		const item = this.toUpload[0]!;

		const path = item.getWebsitePath();

		if (path === "index.html") return SyncActionTag.IndexHtml;

		const extension = item.getFileExtension();

		const isHtml = extension === "html" || extension === "htm";
		const isOverwrite = this.force;

		if (isOverwrite) {
			if (isHtml) {
				return SyncActionTag.HtmlOverwrite;
			} else {
				return SyncActionTag.AssetOverwrite;
			}
		} else {
			if (isHtml) {
				return SyncActionTag.HtmlUpload;
			} else {
				return SyncActionTag.AssetUpload;
			}
		}
	}

	toVerboseString(): string {
		const fileNameString = this.toUpload
			.map((v) => `\n\t${v.toString()}`)
			.toString();

		if (this.force) {
			return `Bulk Upload (overwriting): ${fileNameString}`;
		} else {
			return `Bulk Upload (new files): ${fileNameString}`;
		}
	}
}

export class BulkNeocitiesDeleteSyncAction implements SyncAction {
	constructor(
		readonly filesystem: NeocitiesFilesystem,
		public toDelete: NeocitiesFilesystemFile[],
		public batchSize = 20,
	) {}

	progress = new Progress("deleting");

	run() {
		return this.progress.hookToFunction(async (progress) => {
			await progress.defer(
				this.filesystem.deleteFilesInBulk(this.toDelete),
			);
		});
	}

	attemptToMerge(action: SyncAction): boolean {
		if (!(action instanceof BulkNeocitiesDeleteSyncAction)) {
			return false;
		}

		if (this.toDelete.length + action.toDelete.length > this.batchSize) {
			return false;
		}

		this.toDelete.push(...action.toDelete);

		return true;
	}

	getTag(): SyncActionTag {
		if (this.toDelete.length !== 1) return SyncActionTag.Unknown;

		const item = this.toDelete[0]!;

		const extension = item.getFileExtension();

		if (extension === "html" || extension === "htm") {
			return SyncActionTag.HtmlDeletion;
		}

		return SyncActionTag.AssetDeletion;
	}

	toVerboseString(): string {
		const fileNameString = this.toDelete
			.map((v) => `\n\t${v.toString()}`)
			.toString();

		return `Bulk Delete: ${fileNameString}`;
	}
}

export class CopyReplaceSyncAction implements SyncAction {
	constructor(
		readonly from: FilesystemFile,
		readonly destination: FilesystemFile,
	) {}

	progress = new Progress("copying and replacing");

	run() {
		return this.progress.hookToFunction(async (progress) => {
			const data = await progress.defer(this.from.readAsStream());

			await progress.defer(this.destination.overwrite(data));
		});
	}

	toVerboseString(): string {
		return `Copy to existing file: ${this.from.toString()} -> ${this.destination.toString()}`;
	}
}

export class CopyCreateSyncAction implements SyncAction {
	constructor(
		readonly from: FilesystemFile,
		readonly destinationFilesystem: Filesystem<FilesystemFile>,
	) {}

	progress = new Progress("copying");

	run() {
		return this.progress.hookToFunction(async (progress) => {
			const data = await progress.defer(this.from.readAsStream());

			const uncommitted =
				this.destinationFilesystem.createUncommittedFile(
					this.from.getWebsitePath(),
				);

			this.destinationFilesystem.addFile(uncommitted);

			await progress.defer(uncommitted.initiallyWrite(data));
		});
	}

	toVerboseString(): string {
		const uncommitted = this.destinationFilesystem.createUncommittedFile(
			this.from.getWebsitePath(),
		);

		return `Duplicate file: ${this.from.toString()} -> ${uncommitted.toString()}`;
	}
}
