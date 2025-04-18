/** a generic esbuild loader.
 * 
 * ## How the loader works:
 * 
 * To put it simply, a subclass of {@link GenericLoader} performs the following steps in order:
 * 
 * 1. {@link GenericLoader.extractDeps} parses the dependencies of the provided `content`.
 * 2. {@link GenericLoader.parseToJs} creates a javascript-code that dynamically imports the dependencies, and exports the original `content`.
 * 3. [**you**](https://en.wikipedia.org/wiki/human) pass the javacscript-code to `esbuild` for bundling and transformation of the import statements.
 * 4. {@link GenericLoader.unparseFromJs} parses the resulting output javascript-code and extracts the new path names of the dependencies.
 * 5. {@link GenericLoader.injectDeps} merges back the parsed dependencies to the original `content`.
 * 
 * ## Loader usage example:
 * 
 * Here is how you would typically use a subclass of the {@link GenericLoader}:
 * 
 * - instantiate a {@link GenericLoader} instance with optional config (which currently does nothing).
 * 
 * ```ts
 * // make sure that you have extended `GenericLoader` and redefined the abstract methods
 * class MyLoader extends GenericLoader {}
 * 
 * const my_file_loader = new MyLoader({
 * 	path: "D:/my/project/my_file.xyz",
 * })
 * ```
 * 
 * - convert the contents of the file you wish to bundle to equivalent javascript code using the {@link GenericLoader.parseToJs} method.
 * 
 * ```ts
 * const js_content = await my_file_loader.parseToJs()
 * ```
 * 
 * - pass the js content to your esbuild plugin's `onLoad` result, or use it as an entrypoint via `stdin`.
 * 
 * ```ts
 * const build_result = await esbuild.build({
 * 	absWorkingDir: "D:/my/project/",
 * 	splitting: true,  // required, so that the bundled `js_content` imports the referenced dependency files, instead of having them injected.
 * 	format: "esm",    // required for the `splitting` option to work
 * 	bundle: true,     // required, otherwise all links/dependencies will be treated as "external" and won't be transformed.
 * 	outdir: "./out/", // required, for multiple output files
 * 	write: false,     // required, because the bundled content needs to exist in-memory for us to transform/unparse it back to its original form.
 * 	minify: true,     // optiotnal, useful for treeshaking.
 * 	chunkNames: "[ext]/[name]-[hash]", // optional, useful for specifying the structure of the output directory
 * 	assetNames: "assets/[name]-[hash]", // optional, useful for specifying the structure of the output directory
 * 	plugins: [...denoPlugins()], // optional, use the Deno esbuild plugin to resolve "http://", "file://", "jsr:", and "npm:" imports.
 * 	stdin: {
 * 		contents: js_content,
 * 		loader: "ts",
 * 		resolveDir: "D:/my/project/",
 * 		sourcefile: "D:/my/project/my_file.xyz",
 * 	},
 * })
 * ```
 * 
 * - once the build is complete, convert back the bundled entrypoint from javascript to your file's format using the {@link GenericLoader.unparseFromJs} method.
 * 
 * ```ts
 * const js_content_bundled = build_result.outputFiles[0].text // assuming that the first output file corresponds to your entrypoint
 * const my_file_bundled = await my_file_loader.unparseFromJs(js_content_bundled)
 * ```
 * 
 * - merge back the string contents of `my_file_bundled` to `build_results.outputFiles`,
 *   and then write the outputs to the filesystem using the {@link "fs"!writeOutputFiles} utility function.
 * 
 * ```ts
 * const { hash, path } = outputs.outputFiles[0]
 * build_result.outputFiles[0] = { text: my_file_bundled, hash, path }
 * await writeOutputFiles(outputs.outputFiles)
 * ```
 * 
 * @module
*/

import { DEBUG, escapeLiteralStringForRegex, json_stringify, zipArrays, zipIteratorsMapperFactory } from "./deps.ts"
import type { ContentDependencies, GenericLoaderConfig, ImportMetadata, ImportMetadataEntry, ScriptWrappedContent } from "./typedefs.ts"


const
	defaultGenericLoaderConfig: GenericLoaderConfig = { meta: true },
	escape_regex_for_string_raw = /(\$)|(\`)|(\<\/script\>)/g,
	imports_beginning_marker = "globalThis.start_of_imports()",
	imports_ending_marker = "globalThis.end_of_imports()",
	import_statements_block_regex = new RegExp(
		escapeLiteralStringForRegex(imports_beginning_marker)
		+ "[\,\;]*" // if esbuild minification is enabled, then either a ";" or a "," delimiter will be placed between statements instead of a new line.
		+ `(?<importStatements>.*?)`
		+ escapeLiteralStringForRegex(imports_ending_marker),
		"gs",
	),
	import_statement_regex = new RegExp("await\\s+import\\(\\s*\"(?<importPath>.*?)\"\\s*\\)[\,\;]*", "g"),
	deps_list_to_js_fn = zipIteratorsMapperFactory<[string, string], string>(
		([import_key, import_path]): string => {
			return `
importKeys.push(${json_stringify(import_key)})
await import(${json_stringify(import_path)})`
		}
	)

/** the base class for creating custom loaders for any file type that is natively unsupported by `esbuild`.
 * - each loader _class_ handles one type of new file type.
 * - each loader _instance_ handles **one file**, and can be used only **once**, so that it does not hog onto resources.
*/
export abstract class GenericLoader<K = string> {
	public config: GenericLoaderConfig
	public meta: { imports: ImportMetadata<K> } = { imports: [] }

	constructor(config?: Partial<GenericLoaderConfig>) {
		this.config = { ...defaultGenericLoaderConfig, ...config }
	}

	/** this abstract method is supposed to consume the provided raw {@link content}
	 * and return back the object {@link ContentDependencies} that describes the list of dependencies,
	 * in addition to providing a unique immutable key for each dependency path
	 * (so that it can be recognized and re-injected after being transformed by esbuild).
	 * 
	 * the actions of this function should be invertible by the {@link insertDeps} method.
	*/
	abstract extractDeps(content: string): Promise<ContentDependencies<K>>

	/** this abstract method is supposed to consume the provided {@link dependencies} object
	 * and merge/inject them back into the {@link ContentDependencies.content | `dependencies.content`}.
	 * 
	 * effectively, this function is supposed to invert the actions of the {@link extractDeps} method.
	*/
	abstract insertDeps(dependencies: ContentDependencies<K>): Promise<string>

	/** an overloadable method that should return a javascript-code string that exports the provided {@link content} parameter in the form of `export const content = ...`.
	 * 
	 * by default, the baseclass {@link GenericLoader} escapes all characters of the `content` parameter,
	 * so that the string is perfectly preserved after the virtual module's evaluation. <br>
	 * this is achieved by using `String.raw` and escaping all dollarsigns ("$") and backticks ("\\`") with template expressions.
	 * however, such a thing may not be desirable, and you may want the evaluation of the template expressions within your `content`, rather than suppressing it.
	 * or you may wish to introduce additional functions to the script so that it evaluates the output content through a series of transformations. <br>
	 * in such cases, you would want to overload this method to suit your transformations needs.
	 * but make sure to always `export` variable named `content`.
	 * 
	 * another very important escaping transformation that must take place is for the `"</script>"` closing tag.
	 * this is because esbuild explicitly transforms all strings containing this literal into `"<\\/script>"`,
	 * which is equivalent to the original string and a non-issue, unless `String.raw` is used, where the underlying string becomes deformed.
	 * the reason why esbuild does this explicitly for the `"</script>"` tag is because if someone were to copy and paste their bundled js code into an html's script block,
	 * then the original form of the `"</script>" string would close the script block pre-maturely, leaking the contents ahead of it and turning the html code illegible. <br>
	 * check out the following github issue comment for more info about this transformation:
	 * [github.com/evanw/esbuild/issues/2267#issuecomment-1149396846](https://github.com/evanw/esbuild/issues/2267#issuecomment-1149396846)
	*/
	async contentExportJs(content: string): Promise<string> {
		content = content.replaceAll(escape_regex_for_string_raw, "${\"$&\"}")
		return `export const content = String.raw\`` + content + `\`\n`
	}

	/** this method parses the provided {@link raw_content} parameter,
	 * extracts its dependencies by calling the {@link extractDeps} method,
	 * and then converts it to an equivalent javascript code that can be consumed and analyzed by `esbuild`.
	 * 
	 * the generated javascript code looks like the following:
	 * ```js
	 * export const importKeys = []
	 * globalThis.start_of_imports()
	 * importKeys.push("key_1")
	 * await import("path_1")
	 * // ...
	 * importKeys.push("key_N")
	 * await import("path_N")
	 * globalThis.end_of_imports()
	 * export const content = `${ORIGINAL_RAW_CONTENT}`
	 * ```
	*/
	async parseToJs(raw_content: string): Promise<string> {
		const
			{ content, importKeys, importPaths } = await this.extractDeps(raw_content),
			deps_js_string = [...deps_list_to_js_fn(importKeys, importPaths)].join(""),
			content_export_js = await this.contentExportJs(content)

		if (DEBUG.META) {
			const meta_imports = this.meta.imports
			for (const [key, path] of zipArrays<[K, string]>(importKeys, importPaths)) {
				meta_imports.push({ key, in: path, out: "" })
			}
		}

		return `
export const importKeys = []
${imports_beginning_marker}
${deps_js_string}
${imports_ending_marker}
${content_export_js}`
	}

	/** this method unparses the esbuild-bundled javascript code generated by {@link parseToJs},
	 * and analyzes the transformed paths of the imported dependencies,
	 * and then injects back the transformed paths back to the original raw contents through the {@link insertDeps} method.
	*/
	async unparseFromJs(js_content: string): Promise<string> {
		const importPaths: string[] = []

		const js_content_without_imports = js_content.replaceAll(import_statements_block_regex, (_full_match, ...args) => {
			// here, `_full_match` is:
			// `${imports_beginning_marker}\n${deps_js_string}\n${imports_ending_marker}`
			const
				[named_groups, _full_string, _offset, ..._unused_groups] = args.toReversed(),
				marked_import_statements = named_groups.importStatements as string
			// now, `marked_import_statements` is:
			// `\n${deps_js_string}\n`
			const ordered_import_key_statements = marked_import_statements.replaceAll(import_statement_regex, (_full_match, ...args) => {
				// here, `_full_match` is:
				// `await import(${JSON.stringify(bundled_import_path)})`
				const
					[named_groups, _full_string, _offset, ..._unused_groups] = args.toReversed(),
					bundled_import_path = named_groups.importPath as string
				importPaths.push(bundled_import_path)
				// since we will be dynamically running/evaluating our `js_content` as a module, in order to retrieve the original raw content,
				// we will have to strip away these dynamic imports, since they are a dependency of the raw content, but not a requirement to _load_ the raw content.
				return ""
			})
			/** all what remains now is:
			 * ```js
			 * export const importKeys = []
			 * importKeys.push("key_1")
			 * // ...
			 * importKeys.push("key_N")
			 * export const content = `${ORIGINAL_RAW_CONTENT}`
			 * ```
			*/
			return ordered_import_key_statements
		})

		const
			js_blob = new Blob([js_content_without_imports], { type: "text/javascript" }),
			js_blob_url = URL.createObjectURL(js_blob),
			// now we dynamically load our bundled js script that contains the raw contents (`content`),
			// and the ordered list of uniqie keys associated with each import path (`importKeys`)
			{ content, importKeys } = await import(js_blob_url) as ScriptWrappedContent<K>,
			{ meta: { imports: metaImports }, config: { meta: metaEnabled } } = this,
			number_of_imports = importKeys.length

		if (DEBUG.ASSERT && (
			number_of_imports !== importPaths.length
			|| (DEBUG.META && metaEnabled && number_of_imports !== metaImports.length)
		)) {
			throw new Error("encountered a mismatch between number of imported dependencies, and number of keys assigned to dependencies")
		}

		if (DEBUG.META && metaEnabled) {
			for (const [key, path, import_entry] of zipArrays<[K, string, ImportMetadataEntry<K>]>(importKeys, importPaths, metaImports)) {
				if (DEBUG.ASSERT && (json_stringify(key) !== json_stringify(import_entry.key))) {
					throw new Error("encountered a mismatch between the original key and the key obtained from evaluating javascript module")
				}
				import_entry.out = path
			}
		}

		return this.insertDeps({
			importKeys,
			importPaths,
			content,
		})
	}
}
