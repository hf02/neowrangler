import type { Progress } from "../Progress.js";
import { LocalFilesystem, LocalFilesystemFile } from "./LocalFilesystem.js";
import {
	WritableLocalFilesystem,
	WritableLocalFilesystemFile,
} from "./WritableLocalFilesystem.js";

export class FilesystemFactory {
	static createLocalFilesystemFromDirectory(
		relativeSystemPath: string,
	): Progress<LocalFilesystem> {
		const system = new LocalFilesystem(relativeSystemPath);
		return system.loadFromDirectory(LocalFilesystemFile);
	}

	static createWritableLocalFilesystemFromDirectory(
		relativeSystemPath: string,
	): Progress<WritableLocalFilesystem> {
		const system = new WritableLocalFilesystem(relativeSystemPath);
		return system.loadFromDirectory(WritableLocalFilesystemFile);
	}
}
