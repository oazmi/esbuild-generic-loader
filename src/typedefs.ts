/** this module contains base type definitions.
 * 
 * @module
*/
import type { GenericLoader } from "./loader.ts"


export type RelativePath = string
export type AbsolutePath = string
export type Path = RelativePath | AbsolutePath

export interface GenericLoaderConfig {
	/** the absolute path of the file that you are providing the contents of to {@link GenericLoader}.
	 * 
	 * this value is used for deducing the directory in which the html exists, so that any relative references made in the html file will be discoverable. <br>
	 * if no path is provided, then it will be assumed that the html file exists in the current working directory (i.e. something like `"./index.html"`). <br>
	 * the absolute path can also use a uri scheme like `"http://"` or `"jsr:"` or `"file://"`, but if a relative path was provided,
	 * we would again assume that it is relative to the current working directory.
	*/
	path?: AbsolutePath

	/** TODO: define how the file should bundle its dependencies:
	 * - `"bundle"` | `undefined`: the file will reference its entry points will be bundled as separate files, inheriting the basename of the importer javascript.
	 * - `"inject"`: any referenced files via `<script src="./file.js">` or `<link rel="stylesheet" href="./file.css">` will get injected be bundled into a string literal, which will then get injected into your html `document`'s head as a `<style>` element.
	 * - `"inject-link"`: similar to `"bundle"`, but will also inject a `<link>` element into your `document`'s head that link's to the output bundled file.
	*/
	mode?: "bundle" | "inject" | "inject-link"
}

/** an interface that describes the dependencies and contents of a single file that is parsed by your loader's {@link GenericLoader.extractDeps} method. */
export interface ContentDependencies<K = string> {
	/** an ordered list of unique json-encodable key assigned for each dependency path. */
	importKeys: Array<K>
	/** an ordered list of dependency paths that your file requires for bundling. */
	importPaths: Array<string>
	/** the contents of your loaded file, further transformed to replace the {@link importPaths | import-paths}
	 * with {@link importKeys | unique-keys} that are easily identifiable and replaceable later on.
	*/
	content: string
}

/** an interface similar to {@link ContentDependencies}, but with its {@link content} now containing javascript code that can be dynamically imported. */
export interface ScriptWrappedContent<K = string> extends ContentDependencies<K> {
	content: string
}

/** an entry in {@link GenericLoader.meta["imports"]} that specifies the transformation of a dependency path, after the unparsing is complete.
 * 
 * @typeParam K the key `K` must be a json encodable key
*/
export interface ImportMetadataEntry<K = string> {
	/** unique key assigned by the dependency extractor method {@link GenericLoader.extractDeps}. */
	key: K
	/** the original path of the import link. */
	in: string
	/** the output bundled path of the import link. */
	out: string
}

/** an array of metadata entries {@link ImportMetadataEntry}. */
export type ImportMetadata<K = string> = Array<ImportMetadataEntry<K>>
