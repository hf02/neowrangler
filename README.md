# Neowrangler

A fast uploader for neocities. It uploads much quicker than the official CLI by batching them together.

Neowrangler is currently still in development, but it's good enough to where I use it.

## Features

-   Uploads way faster than the Neocities CLI.
-   Supports gitignore files. (You have to specify them.)
-   Diffs files wayyyyy faster than the Neocities CLI. Like if you have no changes, it'll almost instantly say so and terminate.
-   Reads your API key from your environment variables, or a .env file.
-   Can also delete files on your site if you want.

## Install

In the future, you'll install it using NPM. But for now...

1. Install Node.js if you haven't.
2. Clone the repo somewhere.
3. Run `npm i` and then `npm run build` in the repo.
4. Copy the path of the index.js file in the root of the repo.
5. Run it using that path. Very ugly!

```
$ node ~/path/to/that/repo/index.js push .
```

## Usage

Oddity to make note of. Just running `neomanager` does nothing. That's a bug. Try running `neomanager --help` instead.

### Logging in

Get your API key. [In Neocities's settings page](https://neocities.org/settings), click "Manage Site Settings" for the site you want to use. Then, go to the API tab. Generate it if you need to.

Neowrangler doesn't have a login command: it instead gets your API key from your environment variables or a .env file. By default, it's looking for `NEOCITIES_API_KEY`.

Not sure what that means? You want to make a `.env` file wherever you'll be using Neowrangler. In that file, put your API key there like so:

```env
NEOCITIES_API_KEY=7b4ce852c5a7360e32698f1668c60bad
```

This has the added benefit of being able to upload to different sites for different projects without needing to make sure you're changing accounts everytime.

### Pushing/Uploading

To upload the current directory you're in:

```
$ neowrangler push .
```

Neowrangler by default won't delete any files on your website. To do that, use `--prune`:

```
$ neowrangler push . --prune
```

To see what Neowrangler will do without making any changes to your Neocities website, use `--dry-run`:

```
$ neowrangler push . --dry-run
```

If you want, you can also have Neowrangler not overwrite any files on your website that already exist:

```
$ neowrangler push . --no-overwrite
```

You can also change the environment variable it's looking for:

```
$ neowrangler push . --neocities-key-env=NEOWRANGLER_API_KEY
```

You can of course mix the flags. Neowrangler uses Yargs for the command line, so I don't expect any issues to appear relating to this.

```
$ neowrangler push . --prune --dry-run
```

### Ignore files

Neowrangler supports ignore files. They take the same syntax as .gitignore files.

It won't look for them by default. You have to provide the path.

```
$ neowrangler push . --ignore-file=.ignore
```

Everything specified in there will ignore all files that exist on Neocities and on your disk. So, if you have a `/test` folder that is ignored, it won't upload from that wolder. It also won't delete anything in there if you're using `--prune`. Internally, its as if those files didn't exist at all.

#### Ignoring files not supported on a free account

To ignore all files that you need a Supporter account for, you can use this line in your ignore file:

```
# @neowrangler supporter
```

This has the added benefit of not deleting any supporter-only files leftover you may already have when using `--prune`.

#### Advanced

You can also be more specific. Note this is playing with fire, and when using `--prune`, you may screw up your site. I may remove this feature later if there's not a good use-case for it.

```
$ neowrangler push . --local-ignore-file=.ignore-local --remote-ignore-file=.ignore-remote
```

## Roadmap

In no particular order:

### Feature-wise

-   Put up on npm.
-   Running just `neowrangler` does nothing. It should at least show something.
-   Better output. Currently it just vomits its current status and doesn't accurately show progress.
-   Handle folders. It currently isn't aware of them, which comes with the side effect of `--prune` not deleting empty folders.
-   Errors should recover somehow.
-   Be able to select which files to upload last. This would let you control what Neocities features in the site update post.

### Refactoring

-   Progress.ts is a bit complex, and its progress indicator doesn't seem to be working right.
    -   It's also somewhat confusing. It acts like a Promise, but its timing isn't like a Promise.
-   The types for Filesystem.ts is overly complex.
-   File names aren't consistent.
-   The current CLI was sorta just thrown together. The logic should probably be taken out of index.ts.
-   CLI lacks tests.
-   Each part is tested independently, but there's no tests for them as a whole.
-   Tests that work against the actual Neocities API are selectively ran by commenting out a `return;` in its .test.ts file. It probably shouldn't be like that.
-   FilesystemFactory is kinda dumb. Those functions should be make static members on the classes itself.
