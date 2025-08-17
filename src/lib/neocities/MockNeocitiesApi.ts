import { Progress } from "../Progress.js";
import {
	NeocitiesApi,
	NeocitiesApiFile,
	NeocitiesApiFileListEntry,
	NeocitiesApiInfoEndpointInfo,
	NeocitiesApiResultType,
	NeocitiesApiSiteInfo,
	NeocitiesApiSuccessResult,
	NeocitiesApiUploadEndpoint,
} from "./NeocitiesApi.js";
import {
	NeocitiesApiError,
	NeocitiesApiErrorType,
} from "./NeocitiesApiError.js";

const files = [
	{
		is_directory: false,
		path: "index.html",
		sha1_hash: "testtesttest",
		size: 10,
	},
	{
		is_directory: false,
		path: "cat.png",
		sha1_hash: "etnesngesnetsn",
		size: 1000,
	},
] as const satisfies NeocitiesApiFile[];

export class MockNeocitiesApi extends NeocitiesApi {
	protected fetchEndpoint<T>(
		url: URL,
	): Progress<NeocitiesApiSuccessResult<T>> {
		throw new Error(
			"called getRequest in MockNeocitesApi! don't do that!!",
		);
	}

	fetchSiteInfo(site?: string): Progress<NeocitiesApiSiteInfo> {
		return Progress.runAsync("fetching site info", async (progress) => {
			const mockSites: Record<
				string,
				NeocitiesApiInfoEndpointInfo | undefined
			> = {
				dabric: {
					sitename: "dabric",
					views: 616559,
					hits: 2200477,
					created_at: "Sun, 16 Feb 2020 05:29:12 -0000",
					last_updated: "Fri, 08 Aug 2025 18:51:44 -0000",
					domain: "dabric.xyz",
					tags: ["personal", "ssg", "programming"],
				},
				arandomsite: {
					sitename: "arandomsite",
					views: 532342,
					hits: 176378,
					created_at: "Fri, 20 Aug 2021 18:31:14 -0000",
					last_updated: "Wed, 18 Jun 2025 03:30:10 -0000",
					domain: null,
					tags: [],
				},
			};

			const foundSite = mockSites[site ?? "dabric"];

			if (foundSite == null) {
				throw new NeocitiesApiError(
					NeocitiesApiErrorType.SiteNotFound,
					"site was not found",
				);
			}

			return new NeocitiesApiSiteInfo(foundSite);
		});
	}

	deleteFiles(
		files: string[],
	): Progress<NeocitiesApiSuccessResult<NeocitiesApiUploadEndpoint>> {
		return Progress.resolve({
			message: "yep",
			result: NeocitiesApiResultType.Success,
		});
	}

	downloadFile(path: string): Progress<Buffer> {
		if (path === "index.html") {
			return Progress.resolve<Buffer>(
				Buffer.from("<!doctype html> I'm an html document?"),
			);
		}

		if (path === "cat.png") {
			return Progress.resolve<Buffer>(Buffer.from("meow"));
		}

		throw new NeocitiesApiError(
			NeocitiesApiErrorType.HttpNotFound,
			"file not found",
		);
	}

	fetchFileList(path?: string): Progress<NeocitiesApiFileListEntry[]> {
		return Progress.resolve(files);
	}
}
