import { NeocitiesApiErrorResult } from "./NeocitiesApi.js";

export enum NeocitiesApiErrorType {
	ServerError = "server_error",

	/**
	 * /api/upload-hash/ - endpoint is undocumented. unknown
	 */
	NestedParametersNotAllowed = "nested_parameters_not_allowed",

	/**
	 * /api/upload/ - when trying to upload to a site that wasn't found.
	 *
	 * /api/info/ - when trying to get info about a site that wasn't found.
	 */
	SiteNotFound = "site_not_found",
	/**
	 * /api/upload/ - not allowed to change site with your current logged in site
	 */
	SiteNotAllowed = "site_not_allowed",
	/**
	 * /api/upload/ - when not providing files to upload.
	 *
	 * /api/delete/ - when a file to delete was not found.
	 */
	MissingFiles = "missing_files",
	/**
	 * /api/upload/ - hit the storage limit
	 */
	TooLarge = "too_large",
	/**
	 * /api/upload/ - hit the file count limit
	 */
	TooManyFiles = "too_many_files",
	/**
	 * /api/upload/ - needs supporter to upload this file
	 */
	InvalidFileType = "invalid_file_type",

	/**
	 * /api/upload/ - trying to upload a file, but its path is being used for an existing directory
	 */
	DirectoryExists = "directory_exists",

	/**
	 * /api/upload/ - the individual file itself is too large
	 */
	FileTooLarge = "file_too_large",

	/**
	 * /api/upload/ - file path is too long.
	 */
	FilePathTooLong = "file_path_too_long",

	/**
	 * /api/upload/ - file name is too long.
	 */
	FileNameTooLong = "file_name_too_long",

	/**
	 * /api/rename/ - missing arguments.
	 */
	MissingArguments = "missing_arguments",

	/**
	 * /api/rename/ - target path is invalid
	 */
	BadPath = "bad_path",
	/**
	 * /api/rename/ - destination path is invalid
	 */
	BadNewPath = "bad_new_path",

	/**
	 * /api/rename/ - could not find the file.
	 */
	MissingFile = "missing_file",

	/**
	 * /api/rename/ - generic error
	 */
	RenameError = "rename_error",

	/**
	 * /api/delete/ - missing file paths
	 */
	MissingFilenames = "missing_filenames",

	/**
	 * /api/delete/ - filename isn't valid
	 */
	BadFilename = "bad_filename",

	/**
	 * /api/delete/ - when trying to delete /.
	 */
	CannotDeleteSiteRoot = "cannot_delete_site_directory",

	/**
	 * /api/delete/ - when trying to delete /index.html.
	 */
	CannotDeleteIndex = "cannot_delete_index",

	/**
	 * invalid authentication
	 */
	InvalidAuthentication = "invalid_auth",

	/**
	 * the requested endpoint wasn't found.
	 */
	EndpointNotFound = "not_found",

	/**
	 * general 404. used by neowrangler for stuff like downloading directly from a site.
	 */
	HttpNotFound = "neowrangler_404",
	/**
	 * general 403. used by neowrangler for stuff like downloading directly from a site.
	 */
	HttpForbidden = "neowrangler_403",

	/**
	 * general HTTP error. used by neowrangler for stuff like downloading directly from a site.
	 */
	HttpError = "neowrangler_http",
}

export class NeocitiesApiError {
	constructor(
		readonly type: NeocitiesApiErrorType,
		readonly message: string,
	) {}

	humanReadableMessage(): string {
		switch (this.type) {
			case NeocitiesApiErrorType.ServerError:
				return `Neocities has encountered an internal server error.`;
			case NeocitiesApiErrorType.SiteNotFound:
				return "The provided site doesn't exist.";
			case NeocitiesApiErrorType.SiteNotAllowed:
				return `The logged in account doesn't have permission to edit this site.`;
			case NeocitiesApiErrorType.MissingFiles:
				return "No files were provided to upload, or a file requested to delete was not found.";
			case NeocitiesApiErrorType.TooLarge:
				return "The site does not have enough space left.";
			case NeocitiesApiErrorType.TooManyFiles:
				return "The site has hit the file count limit.";
			case NeocitiesApiErrorType.InvalidFileType:
				return "The site's current plan does not support this file type.";
			case NeocitiesApiErrorType.DirectoryExists:
				return "The file's path is already being used for a folder.";
			case NeocitiesApiErrorType.FileTooLarge:
				return "The file itself is too large to upload.";
			case NeocitiesApiErrorType.FilePathTooLong:
				return "The file's path would be too long.";
			case NeocitiesApiErrorType.FileNameTooLong:
				return "The file's name is too long.";
			case NeocitiesApiErrorType.MissingArguments:
				return "Missing arguments when renaming.";
			case NeocitiesApiErrorType.BadPath:
				return "The path of the file or folder to rename is invalid.";
			case NeocitiesApiErrorType.BadNewPath:
				return "The path of the file or folder to rename to is invalid.";
			case NeocitiesApiErrorType.MissingFile:
				return "Could not find the file or folder to rename.";
			case NeocitiesApiErrorType.RenameError:
				return "Neocities had an issue renaming the file or folder.";
			case NeocitiesApiErrorType.MissingFilenames:
				return "Missing the files or folders to delete.";
			case NeocitiesApiErrorType.BadFilename:
				return "The name of the file or folder to delete is invalid.";
			case NeocitiesApiErrorType.CannotDeleteSiteRoot:
				return "Deleting the root folder of a site is not allowed.";
			case NeocitiesApiErrorType.CannotDeleteIndex:
				return "Deleting /index.html is not allowed";
			case NeocitiesApiErrorType.InvalidAuthentication:
				return "The username, password, or API token is not valid.";
			case NeocitiesApiErrorType.EndpointNotFound:
				return `The API endpoint requested does not exist.`;
			case NeocitiesApiErrorType.NestedParametersNotAllowed:
				return `Nested parameters not allowed.`;
			case NeocitiesApiErrorType.HttpNotFound:
				return `HTTP 404 Not found.`;
			case NeocitiesApiErrorType.HttpForbidden:
				return `HTTP 403 Forbidden.`;
			case NeocitiesApiErrorType.HttpError:
				return `HTTP error.`;
		}
	}

	static fromResult(result: NeocitiesApiErrorResult): NeocitiesApiError {
		return new NeocitiesApiError(result.error_type, result.message);
	}

	toString() {
		return `${this.humanReadableMessage()} (${this.message})`;
	}
}
