/** this submodule contains utility functions for writing esbuild's virtual output to the filesystem.
 *
 * this submodule is separated from the rest since it performs filesystem operations, which is runtime-dependant,
 * and we don't want to impact the portability of the main module.
 *
 * @module
*/
import "./_dnt.polyfills.js";
import { console_log, ensureEndSlash, ensureFile, getRuntimeCwd, identifyCurrentRuntime, isString, promise_all, resolvePathFactory, writeFile, writeTextFile } from "./deps.js";
const runtime_enum = identifyCurrentRuntime(), runtime_cwd = ensureEndSlash(getRuntimeCwd(runtime_enum));
/** get the current working directory (i.e. `process.cwd()` or `Deno.cwd`) in posix path format. */
export const getCwdPath = () => { return runtime_cwd; };
/** resolve a file path so that it becomes absolute, with unix directory separator ("/"). */
export const resolvePath = resolvePathFactory(getCwdPath);
/** print some basic useful information on the console.
 * the print will only appear if the logging-level is either set to `"basic"` or `"verbose"` via {@link setLog}
*/
const logBasic = (log_level, ...data) => {
    if (log_level === "basic" || log_level === "verbose") {
        console_log(...data);
    }
};
/** print verbose details on the console.
 * the print will only appear if the logging-level is either set to `"verbose"` via {@link setLog}
*/
const logVerbose = (log_level, ...data) => {
    if (log_level === "verbose") {
        console_log(...data);
    }
};
/** write a collection of virtual files to your filesystem.
 * this function accepts virtual files that are either in text (`string`), binary (`Uint8Array`), or streamable text/binary (`ReadableStream<string | Uint8Array>`) formats.
 * it is important that you provide the configuration parameter's {@link config["dir"] | `dir`} field, so that relative paths can be resolved according to the provided directory.
*/
export const createFiles = async (virtual_files, config = {}) => {
    const { dir = "./", log = "basic", dryrun = false } = config;
    // writing text or binary files
    logBasic(log, "[in-fs] writing additional text/binary files to your build directory");
    await promise_all(virtual_files.map(async ([dst_path, content, options]) => {
        const abs_dst = resolvePath(dir, dst_path);
        logVerbose(log, `[in-fs] writing file to: "${abs_dst}"`, "with the configuration:", options);
        if (!dryrun) {
            await ensureFile(runtime_enum, abs_dst);
            if (isString(content)) {
                await writeTextFile(runtime_enum, abs_dst, content, options);
            }
            else {
                await writeFile(runtime_enum, abs_dst, content, options);
            }
        }
    }));
};
/** write `esbuild` output files (`BuildResult.outputFiles`) to the filesystem. */
export const writeOutputFiles = async (virtual_files, config = {}) => {
    return createFiles(virtual_files.map((virtual_file) => {
        const { path, contents, text } = virtual_file, content = contents ?? text ?? "";
        return [path, content];
    }), config);
};
