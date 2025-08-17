import { Progress } from "../Progress.js";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { LocalFilesystem, LocalFilesystemFile } from "./LocalFilesystem.js";

export class WritableLocalFilesystem<
	T extends WritableLocalFilesystemFile = WritableLocalFilesystemFile,
> extends LocalFilesystem<T> {}

export class WritableLocalFilesystemFile extends LocalFilesystemFile {
	protected override _processDelete(): Progress<void> {
		return Progress.runAsync(
			"deleting file from disk",
			async (progress) => {
				const path = this.getSystemPath();
				await fs.unlink(path);
			},
		);
	}

	override overwrite(data: Buffer | Readable): Progress<void> {
		return Progress.runAsync(
			"overwriting file on disk",
			async (progress) => {
				await progress.defer(this._writeFile(data));
			},
		);
	}

	toString() {
		return `[LocalFile ${this.getSystemPath()}]`;
	}
}
