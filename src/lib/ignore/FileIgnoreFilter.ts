import gitIgnoreParser from "gitignore-parser";
import { FilesystemFile } from "../filesystem/Filesystem";
import fs from "node:fs/promises";
import { doesErrorMatchNodeCode } from "../node/error";

export class FileIgnoreFilter {
	doesIgnoreSupporterFiles = false;

	getIfAcceptsFile(file: FilesystemFile): boolean {
		if (this.doesIgnoreSupporterFiles) {
			if (!file.getIsSupportedOnFree()) {
				return false;
			}
		}

		const path = file.getWebsitePath();

		return this.parser.accepts(path);
	}

	parser;

	constructor(input: string) {
		this.parser = gitIgnoreParser.compile(input);

		const supporterRegex = /^\#(?:(?!\n)\s)*@neowrangler supporter/gm;
		this.doesIgnoreSupporterFiles = supporterRegex.test(input);
	}

	static async readFromPath(path: string): Promise<FileIgnoreFilter> {
		const file = await fs.readFile(path, "utf-8");

		return new FileIgnoreFilter(file);
	}

	static async readFromPossiblePath(
		path?: string,
	): Promise<FileIgnoreFilter> {
		if (!path) {
			return new FileIgnoreFilter("");
		}

		return await this.readFromPath(path);
	}
}
