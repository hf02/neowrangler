import type { Progress } from "../Progress";
import { LocalFilesystem, LocalFilesystemFile } from "./LocalFilesystem";
import {
	WritableLocalFilesystem,
	WritableLocalFilesystemFile,
} from "./WritableLocalFilesystem";

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
