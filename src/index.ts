import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import "dotenv/config";
import { NeocitiesApi } from "./lib/neocities/NeocitiesApi";
import { FilesystemFactory } from "./lib/filesystem/FilesystemFactory";
import { NeocitiesFilesystem } from "./lib/neocities/NeocitiesFilesystem";
import { SyncActionPlan } from "./lib/synchronizer/Synchronizer";
import { FileIgnoreFilter } from "./lib/ignore/FileIgnoreFilter";
import { Progress } from "./lib/Progress";
import { ProgressDisplay } from "./lib/progress/ProgressDisplay";

yargs()
	.scriptName("neowrangler")
	.usage("$0 <cmd> [args]")
	.command(
		"push <directory>",
		"upload a directory recursively to neocities",
		(yargs) => {
			yargs
				.positional("no-overwrite", {
					type: "boolean",
					describe: "don't overwrite existing files on neocities.",
					default: false,
				})
				.positional("prune", {
					type: "boolean",
					describe:
						"delete files on neocities that aren't in the given directory.",
					default: false,
				})
				.positional("gitignore", {
					type: "string",
					describe:
						"a gitignore file that specifics which files to ignore. to neowrangler, it's like they don't exist on your computer or on neocities.\n(alias for both --local-gitignore and --remote-gitignore)",
				})
				.positional("local-gitignore", {
					type: "string",
					describe:
						"a gitignore file that specifies which files to ignore on your computer and not upload.",
				})
				.positional("remote-gitignore", {
					type: "string",
					describe:
						"a gitignore file that specifics which files to ignore on neocities and not delete when pruning. will still overwrite files.",
				})
				.positional("neocities-key-env", {
					type: "string",
					describe:
						"environment variable to pull the neocities api key from. supports .env files.",
					default: "NEOCITIES_API_KEY",
				})
				.positional("dry-run", {
					type: "boolean",
					describe:
						"just print changes that would be done to the neocities website, without actually committing any of those changes.",
					default: false,
				})
				.conflicts("gitignore", "local-gitignore")
				.conflicts("gitignore", "remote-gitignore");
		},
		async function (argv) {
			const key = process.env[argv.neocitiesKeyEnv as string];

			if (!key) {
				throw new Error("no api key given");
			}

			await Progress.runAsync(
				"pushing to neocities",
				async (progress) => {
					const display = new ProgressDisplay(progress);

					const shouldDisplayRun = argv.dryRun !== true;

					if (shouldDisplayRun) {
						display.start();
					}

					const api = new NeocitiesApi();
					await progress.defer(api.login(key));

					const localFiles =
						await FilesystemFactory.createLocalFilesystemFromDirectory(
							argv.directory as string,
						);

					const neocitiesFiles = new NeocitiesFilesystem(api);
					await progress.defer(neocitiesFiles.loadFromNeocities());

					const localIgnorePath = (argv.gitignore ??
						argv.localGitignore) as string | undefined;
					const remoteIgnorePath = (argv.gitignore ??
						argv.remoteGitignore) as string | undefined;

					const localIgnore =
						await FileIgnoreFilter.readFromPossiblePath(
							localIgnorePath,
						);
					const remoteIgnore =
						await FileIgnoreFilter.readFromPossiblePath(
							remoteIgnorePath,
						);

					localFiles.filter(localIgnore);
					neocitiesFiles.filter(remoteIgnore);

					const sync = new SyncActionPlan();

					sync.shouldDelete = argv.prune as boolean;
					sync.shouldOverwrite = !argv.noOverwrite as boolean;
					sync.shouldDryRun = argv.dryRun as boolean;

					await progress.defer(
						sync.diffFilesystems(localFiles, neocitiesFiles),
					);

					if (sync.actions.length === 0) {
						console.log("Already up to date.");
						display.stop();
						return;
					}

					if (sync.shouldDryRun) {
						display.stop();

						const output = sync.runDry();

						console.log(output.join("\n"));
					} else {
						await progress.defer(
							sync.run("Uploading to Neocities"),
						);
					}
					display.stop();
				},
			);
		},
	)
	.help()
	.parse(hideBin(process.argv));
