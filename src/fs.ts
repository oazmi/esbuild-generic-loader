/** this submodule contains utility functions for writing esbuild's virtual output to the filesystem.
 * 
 * this submodule is separated from the rest since it performs filesystem operations, which is runtime-dependant,
 * and we don't want to impact the portability of the main module.
 * 
 * @module
*/

import { console_log, DEBUG, ensureEndSlash, ensureFileUrlIsLocalPath, getRuntime, getRuntimeCwd, identifyCurrentRuntime, noop, parseFilepathInfo, promise_all, resolvePathFactory, RUNTIME, writeFile, writeTextFile, type WriteFileConfig } from "./deps.ts"
import type { AbsolutePath, Path, RelativePath } from "./typedefs.ts"


export type { WriteFileConfig } from "./deps.ts"

const
	runtime_enum = identifyCurrentRuntime(),
	runtime_cwd = ensureEndSlash(getRuntimeCwd(runtime_enum))

/** get the current working directory (i.e. `process.cwd()` or `Deno.cwd`) in posix path format. */
export const getCwdPath = (): AbsolutePath => { return runtime_cwd }

/** resolve a file path so that it becomes absolute, with unix directory separator ("/"). */
export const resolvePath: ((...segments: Path[]) => AbsolutePath) = resolvePathFactory(getCwdPath)

let node_fs: Awaited<ReturnType<typeof import_node_fs>>

const
	import_node_fs = async () => { return import("node:fs/promises") },
	get_node_fs = async () => { return (node_fs ??= await import_node_fs()) },
	node_ensureDir = async (dir_path: string): Promise<void> => {
		const fs = await get_node_fs()
		return fs
			.mkdir(dir_path, { recursive: true })
			.then(noop, async (error) => {
				// ignore the rejection error if the syscall declares that the directory already exists.
				if ((error.code as string).toUpperCase() === "EEXIST") {
					// making sure that the existing directory-entry is not a file.
					if ((await fs.stat(dir_path)).isDirectory()) { return }
				}
				// otherwise, propagate the error.
				throw error
			})
	},
	node_ensureFile = async (file_path: string): Promise<void> => {
		const fs = await get_node_fs()
		const exists: boolean = await fs
			.stat(file_path)
			.then((stats) => (stats.isFile()), (error) => {
				// capture the case where the syscall declares that the file does not exist.
				if ((error.code as string).toUpperCase() === "ENOENT") { return false }
				// otherwise, propagate the error.
				throw error
			})
		if (exists) { return }
		// if the file does not exist, recursively create its parent directories, and then create the file.
		const parent_dir = parseFilepathInfo(file_path).dirpath
		await node_ensureDir(parent_dir)
		return fs.writeFile(file_path, "")
	}

/** creates a nested directory if it does not already exist.
 * 
 * TODO: migrate this function to `@oazmi/kitchensink`.
 * 
 * @throws an error is thrown if something other than a folder already existed at the provided path.
*/
export const ensureDir = async (dir_path: string | URL): Promise<void> => {
	dir_path = ensureEndSlash(ensureFileUrlIsLocalPath(dir_path))
	const runtime = getRuntime(runtime_enum)
	switch (runtime_enum) {
		case RUNTIME.DENO:
			// deno gracefully accepts any existing folder at the `dir_path`, and only errors when the dir-entry is a file.
			return runtime.mkdir(dir_path, { recursive: true })
		case RUNTIME.BUN:
		case RUNTIME.NODE:
			return node_ensureDir(dir_path)
		default:
			throw new Error(DEBUG.ERROR ? `your non-system runtime environment enum ("${runtime_enum}") does not support filesystem writing operations` : "")
	}
}

/** ensures that the file exists.
 * 
 * if the file already exists, this function does nothing.
 * if the parent directories for the file do not exist yet, they are created recursively.
 * 
 * @throws an error is thrown if something other than a file already existed at the provided path,
 *   or if creating the parent directory had failed.
*/
export const ensureFile = async (file_path: string | URL): Promise<void> => {
	file_path = ensureEndSlash(ensureFileUrlIsLocalPath(file_path))
	const runtime = getRuntime(runtime_enum)
	switch (runtime_enum) {
		case RUNTIME.DENO: {
			const exists: boolean = await runtime
				.stat(file_path)
				.then((stats: any) => (stats.isFile), (error: any) => {
					// capture the case where the syscall declares that the file does not exist.
					if ((error.code as string).toUpperCase() === "ENOENT") { return false }
					// otherwise, propagate the error.
					throw error
				})
			if (exists) { return }
			// if the file does not exist, recursively create its parent directories, and then create the file.
			const parent_dir = parseFilepathInfo(file_path).dirpath
			await ensureDir(parent_dir)
			return runtime.writeFile(file_path, new Uint8Array(0))
		}
		case RUNTIME.BUN:
		case RUNTIME.NODE:
			return node_ensureFile(file_path)
		default:
			throw new Error(DEBUG.ERROR ? `your non-system runtime environment enum ("${runtime_enum}") does not support filesystem writing operations` : "")
	}
}

/** the tuple description of a writable (or appendable) file.
 * - the first entry of the array must describe the destination path of the file,
 *   relative to the directory defined in {@link CreateFilesConfig.dir}).
 * - the second entry should be the file's contents, which can either be a `string` text, a `ReadableStream`, or a `Uint8Array` binary.
 * - the third and optional entry lets you specify additional {@link WriteFileConfig | deno-like file writing options},
 *   such as `"append"` the new text, or permit the creation (`"create"`) of new file if it doesn't exist, etc...
*/
export type WritableFileConfig = [
	destination: RelativePath,
	content: string | Uint8Array,
	options?: WriteFileConfig,
]

/** configuration options for {@link createFiles}. */
export interface CreateFilesConfig {
	/** the desired output directory.
	 * if a relative path is provided, then it will be resolved as a path relative to the current working directory.
	 * (which is generally where `package.json` or `deno.json` resides)
	*/
	dir?: Path

	/** select logging level:
	 * - `false` or `"none"`: skip logging.
	 * - `true` or `"basic"`: log what is being carried out at the top level.
	 * - `"verbose"`: in addition to basic logging, it also logs which files/folders are being copied or generated.
	 * 
	 * @defaultValue `"basic"`
	*/
	log?: boolean | "none" | "basic" | "verbose"

	/** enable `dryrun` if you wish for nothing to be written onto the the filesystem.
	 * 
	 * @defaultValue `false`
	*/
	dryrun?: boolean
}

/** the in-memory output file description generated by `esbuild`. */
export interface EsbuildOutputFile {
	path: AbsolutePath
	text?: string
	contents?: Uint8Array
	hash?: string
}

/** print some basic useful information on the console.
 * the print will only appear if the logging-level is either set to `"basic"` or `"verbose"` via {@link setLog}
*/
const logBasic = (log_level: NonNullable<CreateFilesConfig["log"]>, ...data: any[]): void => {
	if (log_level === "basic" || log_level === "verbose") { console_log(...data) }
}

/** print verbose details on the console.
 * the print will only appear if the logging-level is either set to `"verbose"` via {@link setLog}
*/
const logVerbose = (log_level: NonNullable<CreateFilesConfig["log"]>, ...data: any[]): void => {
	if (log_level === "verbose") { console_log(...data) }
}

/** write a collection of virtual files to your filesystem.
 * this function accepts virtual files that are either in text (`string`), binary (`Uint8Array`), or streamable text/binary (`ReadableStream<string | Uint8Array>`) formats.
 * it is important that you provide the configuration parameter's {@link config["dir"] | `dir`} field, so that relative paths can be resolved according to the provided directory.
*/
export const createFiles = async (virtual_files: Array<WritableFileConfig>, config: CreateFilesConfig = {}): Promise<void> => {
	const { dir = "./", log = "basic", dryrun = false } = config
	// writing text or binary files
	logBasic(log, "[in-fs] writing additional text/binary files to your build directory")
	await promise_all(virtual_files.map(async ([dst_path, content, options]) => {
		const abs_dst = resolvePath(dir, dst_path)
		logVerbose(log, `[in-fs] writing file to: "${abs_dst}"`, "with the configuration:", options)
		if (!dryrun) {
			await ensureFile(abs_dst)
			if (typeof content === "string") {
				await writeTextFile(runtime_enum, abs_dst, content, options)
			} else {
				await writeFile(runtime_enum, abs_dst, content, options)
			}
		}
	}))
}

/** write `esbuild` output files (`BuildResult.outputFiles`) to the filesystem. */
export const writeOutputFiles = async (virtual_files: Array<EsbuildOutputFile>, config: CreateFilesConfig = {}): Promise<void> => {
	return createFiles(virtual_files.map((virtual_file): WritableFileConfig => {
		const
			{ path, contents, text } = virtual_file,
			content = contents ?? text ?? ""
		return [path, content]
	}), config)
}
