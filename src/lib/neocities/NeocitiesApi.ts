import { progressFetch, progressFetchJson } from "../network/ProgressFetch.js";
import { Progress } from "../Progress.js";
import {
	NeocitiesApiError,
	NeocitiesApiErrorType,
} from "./NeocitiesApiError.js";
import { progressHttpJson } from "../network/ProgressHttp.js";
import { RequestOptions } from "node:https";
import FormData from "form-data";
import { Readable } from "node:stream";

export interface NeocitiesApiFile {
	path: string;
	is_directory: false;
	size: number;
	updated_at?: string;
	sha1_hash: string;
}
export interface NeocitiesApiDirectory {
	path: string;
	is_directory: true;
	updated_at: string;
}

export type NeocitiesApiFileListEntry =
	| NeocitiesApiDirectory
	| NeocitiesApiFile;

export interface NeocitiesApiListEndpoint {
	files: NeocitiesApiFileListEntry[];
}

export interface NeocitiesApiInfoEndpointInfo {
	sitename: string;
	hits: number;
	views: number;
	created_at: string;
	last_updated: string | null;
	domain: string | null;
	tags: string[];
}

export interface NeocitiesApiInfoEndpoint {
	info: NeocitiesApiInfoEndpointInfo;
}

export interface NeocitiesApiKeyEndpoint {
	api_key: string;
}

export interface NeocitiesApiUploadEndpoint {
	message: string;
}

export interface NeocitiesApiDeleteEndpoint {
	message: string;
}

export enum NeocitiesApiResultType {
	Success = "success",
	Error = "error",
}

export type NeocitiesApiSuccessResult<T = unknown> = {
	result: NeocitiesApiResultType.Success;
} & T;

export type NeocitiesApiErrorResult = {
	result: NeocitiesApiResultType.Error;
	error_type: NeocitiesApiErrorType;
	message: string;
};

export type NeocitiesApiResult<T = unknown> =
	| NeocitiesApiSuccessResult<T>
	| NeocitiesApiErrorResult;

export interface NeocitiesApiUploadEntry {
	path: string;
	stream: Readable;
}

export class NeocitiesApi {
	constructor() {}

	authorization: string | null = null;

	protected generateNeocitiesEndpointUrl(path = "") {
		return new URL(`https://neocities.org/api/${path}`);
	}

	getDefaultHeaders(): Record<string, string> {
		if (this.authorization == null) {
			return {};
		} else {
			return {
				Authorization: this.authorization,
			};
		}
	}

	protected fetchEndpoint<T>(
		url: URL,
		options?: RequestOptions,
		body?: FormData | Buffer,
	): Progress<NeocitiesApiSuccessResult<T>> {
		return Progress.runAsync(
			"requesting neocities api",
			async (progress) => {
				const [responseBody, response] = await progress.defer(
					progressHttpJson<NeocitiesApiResult<T>>(
						url,
						{
							...options,
							headers: {
								...this.getDefaultHeaders(),
								...options?.headers,
							},
						},
						body,
					),
				);

				if (responseBody.result === NeocitiesApiResultType.Success) {
					return responseBody;
				} else {
					const error = NeocitiesApiError.fromResult(responseBody);
					throw error;
				}
			},
		);
	}

	protected _cachedSiteInfo: NeocitiesApiSiteInfo | null = null;

	fetchSiteInfo(site?: string): Progress<NeocitiesApiSiteInfo> {
		return Progress.runAsync("requesting site info", async (progress) => {
			const url = this.generateNeocitiesEndpointUrl("info");

			if (site) {
				url.searchParams.set("sitename", site);
			}

			const response = await progress.defer(
				this.fetchEndpoint<NeocitiesApiInfoEndpoint>(url),
			);

			return new NeocitiesApiSiteInfo(response.info);
		});
	}

	getCachedSiteInfo(): NeocitiesApiSiteInfo {
		if (this._cachedSiteInfo) {
			return this._cachedSiteInfo;
		}

		throw new NeocitiesApiError(
			NeocitiesApiErrorType.InvalidAuthentication,
			"not logged in",
		);
	}

	login(apiKey: string): Progress<NeocitiesApiSiteInfo> {
		return Progress.runAsync("logging into neocities", async (progress) => {
			this.logout();
			this.authorization = `Bearer ${apiKey}`;

			try {
				const info = await progress.defer(this.fetchSiteInfo());
				this._cachedSiteInfo = info;
				return info;
			} catch (e) {
				this.logout();

				throw e;
			}
		});
	}

	logout() {
		this.authorization = null;
		this._cachedSiteInfo = null;
	}

	fetchFileList(path?: string): Progress<NeocitiesApiFileListEntry[]> {
		return Progress.runAsync(
			"requesting neocities file list",
			async (progress) => {
				const url = this.generateNeocitiesEndpointUrl("list");

				if (path != null) {
					url.searchParams.set("path", path);
				}

				const response = await progress.defer(
					this.fetchEndpoint<NeocitiesApiListEndpoint>(url),
				);

				return response.files;
			},
		);
	}

	downloadFile(path: string): Progress<Buffer> {
		return Progress.runAsync("downloading file", async (progress) => {
			const info = this.getCachedSiteInfo();

			const url = new URL(`https://${info.getDomain()}`);

			url.pathname = path;

			const [buffer, response] = await progress.defer(progressFetch(url));

			if (!response.ok) {
				switch (response.status) {
					case 404:
						throw new NeocitiesApiError(
							NeocitiesApiErrorType.HttpNotFound,
							"file not found",
						);

					case 403:
						throw new NeocitiesApiError(
							NeocitiesApiErrorType.HttpForbidden,
							"forbidden",
						);

					case 500:
						throw new NeocitiesApiError(
							NeocitiesApiErrorType.ServerError,
							response.statusText,
						);

					default:
						throw new NeocitiesApiError(
							NeocitiesApiErrorType.HttpError,
							response.status + " - " + response.statusText,
						);
				}
			}

			return buffer;
		});
	}

	uploadFiles(
		files: NeocitiesApiUploadEntry[],
	): Progress<NeocitiesApiSuccessResult<NeocitiesApiUploadEndpoint>> {
		return Progress.runAsync(
			"uploading batch of files",
			async (progress) => {
				const formData = new FormData();

				for (const file of files) {
					formData.append(file.path, file.stream);
				}

				const url = this.generateNeocitiesEndpointUrl("upload");

				return await progress.defer(
					this.fetchEndpoint(
						url,
						{
							method: "post",
						},
						formData,
					),
				);
			},
		);
	}

	deleteFiles(
		files: string[],
	): Progress<NeocitiesApiSuccessResult<NeocitiesApiUploadEndpoint>> {
		return Progress.runAsync(
			"requesting neocities file deletion",
			async (progress) => {
				const url = this.generateNeocitiesEndpointUrl("delete");

				for (const file of files) {
					url.searchParams.append("filenames[]", file);
				}

				return await progress.defer(
					this.fetchEndpoint(url, {
						method: "post",
					}),
				);
			},
		);
	}
}

export class NeocitiesApiSiteInfo {
	constructor(readonly info: NeocitiesApiInfoEndpointInfo) {}

	getName(): string {
		return this.info.sitename;
	}

	hasCustomDomain(): boolean {
		return this.info.domain != null;
	}

	getDomain(): string {
		if (this.info.domain) {
			return this.info.domain;
		} else {
			return `${this.getName()}.neocities.org`;
		}
	}
}
