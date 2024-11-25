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

import type { ContentDependencies, GenericLoaderConfig, ImportMetadata } from "./typedefs.ts"


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

	abstract parseToJs(): Promise<string>

	abstract unparseFromJs(js_content: string): Promise<string>

	/** dispose the contents of this loader, and label it as no longer useable.
	 * this will help save memory for large builds.
	*/
	dispose() {
		this.content = ""
		this.disposed = true
	}
}
