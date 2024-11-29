# @oazmi/esbuild-generic-loader

A utility library for building generic file loading plugins for esbuild that are compatible with `Deno` runtime and its esbuild plugin ([`jsr:@luca/esbuild-deno-loader`](https://jsr.io/@luca/esbuild-deno-loader)).

## Super mandatory example

```ts
// TODO: never
```

## Documentation link

[`github pages`](https://oazmi.github.io/esbuild-generic-loader/)

## How the loader works:

To put it simply, a subclass of {@link "loader"!GenericLoader} performs the following steps in order:

1. {@link "loader"!GenericLoader.extractDeps} parses the dependencies of the provided `content`.
2. {@link "loader"!GenericLoader.parseToJs} creates a javascript-code that dynamically imports the dependencies, and exports the original `content`.
3. [**you**](https://en.wikipedia.org/wiki/human) pass the javacscript-code to `esbuild` for bundling and transformation of the import statements.
4. {@link "loader"!GenericLoader.unparseFromJs} parses the resulting output javascript-code and extracts the new path names of the dependencies.
5. {@link "loader"!GenericLoader.injectDeps} merges back the parsed dependencies to the original `content`.

## Loader usage example:

Here is how you would typically use a subclass of the {@link "loader"!GenericLoader}:

- instantiate a {@link "loader"!GenericLoader} instance with optional config (which currently does nothing).

```ts
// make sure that you have extended `GenericLoader` and redefined the abstract methods
class MyLoader extends GenericLoader {}

const my_file_loader = new MyLoader({
	path: "D:/my/project/my_file.xyz",
})
```

- convert the contents of the file you wish to bundle to equivalent javascript code using the {@link "loader"!GenericLoader.parseToJs} method.

```ts
const js_content = await my_file_loader.parseToJs()
```

- pass the js content to your esbuild plugin's `onLoad` result, or use it as an entrypoint via `stdin`.

```ts
const build_result = await esbuild.build({
	absWorkingDir: "D:/my/project/",
	splitting: true,  // required, so that the bundled `js_content` imports the referenced dependency files, instead of having them injected.
	format: "esm",    // required for the `splitting` option to work
	bundle: true,     // required, otherwise all links/dependencies will be treated as "external" and won't be transformed.
	outdir: "./out/", // required, for multiple output files
	write: false,     // required, because the bundled content needs to exist in-memory for us to transform/unparse it back to its original form.
	minify: true,     // optiotnal, useful for treeshaking.
	chunkNames: "[ext]/[name]-[hash]",  // optional, useful for specifying the structure of the output directory
	assetNames: "assets/[name]-[hash]", // optional, useful for specifying the structure of the output directory
	plugins: [...denoPlugins()], // optional, use the Deno esbuild plugin to resolve "http://", "file://", "jsr:", and "npm:" imports.
	stdin: {
		contents: js_content,
		loader: "ts",
		resolveDir: "D:/my/project/",
		sourcefile: "D:/my/project/my_file.xyz",
	},
})
```

- once the build is complete, convert back the bundled entrypoint from javascript to your file's format using the {@link "loader"!GenericLoader.unparseFromJs} method.

```ts
const js_content_bundled = build_result.outputFiles[0].text // assuming that the first output file corresponds to your entrypoint
const my_file_bundled = await my_file_loader.unparseFromJs(js_content_bundled)
```

- merge back the string contents of `my_file_bundled` to `build_results.outputFiles`,
  and then write the outputs to the filesystem using the {@link "fs"!writeOutputFiles} utility function.

```ts
const { hash, path } = outputs.outputFiles[0]
build_result.outputFiles[0] = { text: my_file_bundled, hash, path }
await writeOutputFiles(outputs.outputFiles)
```
