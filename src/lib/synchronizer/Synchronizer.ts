import { Filesystem, FilesystemFile } from "../filesystem/Filesystem.js";
import {
	CommittedNeocitiesFilesystemFile,
	NeocitiesFilesystem,
	NeocitiesFilesystemFile,
	PartialNeocitiesFilesystemFile,
} from "../neocities/NeocitiesFilesystem.js";
import { Progress } from "../Progress.js";
import {
	BulkNeocitiesDeleteSyncAction,
	BulkNeocitiesUploadSyncAction,
	CopyCreateSyncAction,
	CopyReplaceSyncAction,
	DeleteSyncAction,
	SyncAction,
	SyncActionTag,
} from "./SyncAction.js";

export class SyncActionPlan {
	actions: SyncAction[] = [];

	uploadBatchCount = 20;
	deleteBatchCount = 20;

	shouldDelete = false;
	// TODO: shouldDeleteSupporter
	shouldOverwrite = false;
	shouldDeleteSupporter = false;

	shouldDryRun = false;

	addAction(action: SyncAction): this {
		this.actions.push(action);

		return this;
	}

	runDry(): string[] {
		const output: string[] = [];

		for (const action of this.actions) {
			output.push(action.toVerboseString());
		}

		return output;
	}

	run(progressName: string): Progress<void> {
		if (this.shouldDryRun) {
			throw new Error("dry run is enabled, but run() was still called");
		}

		return Progress.runAsync(progressName, async (progress) => {
			for (const action of this.actions) {
				await progress.defer(action.run());
			}
		});
	}

	getActionFromFileHashMismatch(
		fileFrom: FilesystemFile,
		fileTo: FilesystemFile,
	): SyncAction {
		if (
			(fileTo instanceof PartialNeocitiesFilesystemFile ||
				fileTo instanceof CommittedNeocitiesFilesystemFile) &&
			fileTo.filesystem
		) {
			return new BulkNeocitiesUploadSyncAction(fileTo.filesystem, [
				fileFrom,
			]);
		}

		return new CopyReplaceSyncAction(fileFrom, fileTo);
	}

	compareFile<A extends FilesystemFile, B extends FilesystemFile>(
		filesystemFrom: Filesystem<A>,
		filesystemTo: Filesystem<B>,
		fileFrom?: A,
		fileTo?: B,
	): Progress<SyncAction | null> {
		return Progress.runAsync("comparing file", async (progress) => {
			if (fileFrom && fileTo) {
				if (!this.shouldOverwrite) return null;

				const hashFrom = await progress.defer(fileFrom.getHash());
				const hashTo = await progress.defer(fileTo.getHash());

				if (hashFrom === hashTo) {
					return null;
				}

				if (filesystemTo instanceof NeocitiesFilesystem) {
					return new BulkNeocitiesUploadSyncAction(
						filesystemTo,
						[fileFrom],
						this.uploadBatchCount,
						true,
					);
				}

				return new CopyReplaceSyncAction(fileFrom, fileTo);
			}

			if (fileFrom && !fileTo) {
				if (filesystemTo instanceof NeocitiesFilesystem) {
					return new BulkNeocitiesUploadSyncAction(
						filesystemTo,
						[fileFrom],
						this.uploadBatchCount,
					);
				}

				return new CopyCreateSyncAction(fileFrom, filesystemTo);
			}

			if (!fileFrom && fileTo) {
				if (!this.shouldDelete) return null;

				if (
					!fileTo.getIsSupportedOnFree() &&
					!this.shouldDeleteSupporter
				) {
					return null;
				}

				if (filesystemTo instanceof NeocitiesFilesystem) {
					return new BulkNeocitiesDeleteSyncAction(
						filesystemTo,
						[fileTo as unknown as NeocitiesFilesystemFile],
						this.deleteBatchCount,
					);
				}

				return new DeleteSyncAction(fileTo);
			}

			return null;
		});
	}

	diffFilesystems(
		from: Filesystem<FilesystemFile>,
		to: Filesystem<FilesystemFile>,
	): Progress<this> {
		return Progress.runAsync("comparing filesystems", async (progress) => {
			progress.maximumProgress = from.files.length + to.files.length;

			const compared = new Set<FilesystemFile>();

			for (const fileFrom of from.files) {
				const fromPath = fileFrom.getWebsitePath();
				const fileTo = to.getFromPath(fromPath) ?? undefined;

				if (compared.has(fileFrom)) {
					continue;
				}

				compared.add(fileFrom);

				const action = await progress.defer(
					this.compareFile(from, to, fileFrom, fileTo),
				);

				if (action) {
					this.addAction(action);
				}

				progress.currentProgress++;
			}

			for (const fileTo of to.files) {
				if (compared.has(fileTo)) {
					continue;
				}

				compared.add(fileTo);

				const toPath = fileTo.getWebsitePath();
				const fileFrom = from.getFromPath(toPath) ?? undefined;

				if (fileFrom && compared.has(fileFrom)) {
					continue;
				}

				const action = await progress.defer(
					this.compareFile(from, to, fileFrom, fileTo),
				);

				if (action) {
					this.addAction(action);
				}

				progress.currentProgress++;
			}

			this.sortActions();
			this.compactActions();

			return this;
		});
	}

	sortActions() {
		this.actions.sort((a, b) => {
			const aTag = a.getTag?.() ?? SyncActionTag.Unknown;
			const bTag = b.getTag?.() ?? SyncActionTag.Unknown;

			return aTag - bTag;
		});
	}

	compactActions() {
		for (let i = 0; i < this.actions.length - 1; i++) {
			const element = this.actions[i]!;
			const nextElement = this.actions[i + 1]!;

			const merged = element.attemptToMerge?.(nextElement);

			if (merged) {
				this.actions.splice(i + 1, 1);
				i--;
			}
		}
	}
}
