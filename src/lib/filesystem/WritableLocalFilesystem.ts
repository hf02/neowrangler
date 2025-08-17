import path from "node:path";
import { freeFileTypes } from "../consts";
import { Progress } from "../Progress";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import crypto from "node:crypto";
import { Filesystem, FilesystemFile } from "./Filesystem";
import { ReadStream } from "node:fs";
import { doesErrorMatchNodeCode } from "../node/error";
import Stream, { Readable } from "node:stream";
import { LocalFilesystem, LocalFilesystemFile } from "./LocalFilesystem";

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
