/** a generic esbuild loader.
 * 
 * ## How it works:
 * - TODO: explain
 * 
 * ## Procedure:
 * - TODO: explain
 * 
 * @module
*/

import { DEBUG } from "./deps.ts"
import { escapeString, escapeStringForRegex, stringToJsEvalString, zipArrays, zipArraysMapperFactory } from "./funcdefs.ts"
import type { ContentDependencies, GenericLoaderConfig, ImportMetadata, ScriptWrappedContent } from "./typedefs.ts"


const
	imports_beginning_marker = "globalThis.start_of_imports()",
	imports_ending_marker = "globalThis.end_of_imports()",
	import_statements_block_regex = new RegExp(
		escapeStringForRegex(imports_beginning_marker)
		+ `(?<importStatements>.*?)`
		+ escapeStringForRegex(imports_ending_marker),
		"gs",
	),
	import_statement_regex = new RegExp("await\\s+import\\(\\s*\"(?<importPath>.*?)\"\\s*\\)", "g"),
	deps_list_to_js_fn = zipArraysMapperFactory<[string, string], string>(
		([import_key, import_path]): string => {
			return `
importKeys.push(${escapeString(import_key)})
await import(${escapeString(import_path)})`
		}
	)

/** the base class for creating custom loaders for any file type that is natively unsupported by `esbuild`.
 * - each loader _class_ handles one type of new file type.
 * - each loader _instance_ handles **one file**, and can be used only **once**, so that it does not hog onto resources.
*/
export abstract class GenericLoader {
	public disposed: boolean = false
	public meta: { imports: ImportMetadata } = { imports: {} }

	constructor(
		public content: string,
		public config: GenericLoaderConfig,
	) { }

	abstract extractDeps(content: string): Promise<ContentDependencies>

	abstract insertDeps(dependencies: ContentDependencies): Promise<string>

	async parseToJs(): Promise<string> {
		const
			{ content, importKeys, importPaths } = await this.extractDeps(this.content),
			deps_js_string = deps_list_to_js_fn(importKeys, importPaths).join("")
		if (DEBUG.META) {
			const meta_imports = this.meta.imports
			for (const [key, path] of zipArrays<[string, string]>(importKeys, importPaths)) {
				(meta_imports[key] ??= {} as any).in = path
			}
		}
		return `
export const importKeys = []
${imports_beginning_marker}
${deps_js_string}
${imports_ending_marker}
export const content = ` + stringToJsEvalString(content) + "\n"
	}

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
				// `await import(${escapeString(bundled_import_path)})`
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
			{ content, importKeys } = await import(js_blob_url) as ScriptWrappedContent,
			number_of_imports = importKeys.length

		if (number_of_imports !== importPaths.length) {
			throw new Error("encountered a mismatch between number of imported dependencies, and number of keys assigned to dependencies")
		}
		if (DEBUG.META) {
			const meta_imports = this.meta.imports
			for (const [key, path] of zipArrays<[string, string]>(importKeys, importPaths)) {
				(meta_imports[key] ??= {} as any).out = path
			}
		}

		return this.insertDeps({
			importKeys,
			importPaths,
			content,
		})
	}

	/** dispose the contents of this loader, and label it as no longer useable.
	 * this will help save memory for large builds.
	*/
	dispose() {
		this.content = ""
		this.disposed = true
	}
}
