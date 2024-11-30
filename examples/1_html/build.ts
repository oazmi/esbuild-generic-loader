import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.0"
import { emptyDir } from "jsr:@std/fs"
import { fromFileUrl } from "jsr:@std/path"
import esbuild from "npm:esbuild"
import { resolveAsUrl } from "../../src/deps.ts"
import { writeOutputFiles } from "../../src/fs.ts"
import { HtmlLoader } from "./loader.ts"


const
	dryrun = false,
	this_dir_path = resolveAsUrl("./", import.meta.url),
	html_file_path = resolveAsUrl("./input/index.html", this_dir_path),
	html_file_content = await (await fetch(html_file_path)).text()

const html_file_loader = new HtmlLoader({ path: fromFileUrl(html_file_path) })
const html_in_js = await html_file_loader.parseToJs(html_file_content)

const results = await esbuild.build({
	absWorkingDir: fromFileUrl(this_dir_path),
	format: "esm",
	target: "esnext",
	platform: "browser",
	stdin: {
		contents: html_in_js,
		loader: "ts",
		resolveDir: fromFileUrl(resolveAsUrl("./", html_file_path)),
		sourcefile: fromFileUrl(html_file_path),
	},
	minify: true,
	outdir: "./output/",
	splitting: true,
	bundle: true,
	write: false,
	assetNames: "assets/[name]-[hash]",
	chunkNames: "[ext]/[name]-[hash]",
	plugins: [...denoPlugins()],
})

const
	[html_in_js_compiled, ...other_output_files] = results.outputFiles,
	html_compiled_text = await html_file_loader.unparseFromJs(html_in_js_compiled.text)

console.log("%c" + `bundled html file: "0", path: "${html_in_js_compiled.path}"`, "color: green; font-weight: bold;")
console.log(html_compiled_text)
other_output_files.forEach((js_file, index) => {
	console.log("%c" + `bundled js file: "${index + 1}", path: "${js_file.path}"`, "color: green; font-weight: bold;")
	console.log(js_file.text)
})

const abs_output_dir = fromFileUrl(resolveAsUrl("./output/", this_dir_path))
console.log(`clearing out the output directory: "${abs_output_dir}"`)
if (!dryrun) { await emptyDir(abs_output_dir) }
await writeOutputFiles([
	{
		path: html_in_js_compiled.path.replace(/\.js$/, ".html"),
		text: html_compiled_text
	}, ...other_output_files
], {
	dir: abs_output_dir,
	log: "verbose",
	dryrun,
})
