import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.11.0"
import { fromFileUrl } from "jsr:@std/path"
import esbuild from "npm:esbuild"
import { resolveAsUrl } from "../../src/deps.ts"
import { HtmlLoader } from "./loader.ts"


const
	this_dir_path = resolveAsUrl("./", import.meta.url),
	html_file_path = resolveAsUrl("./input/index.html", this_dir_path),
	html_file_content = await (await fetch(html_file_path)).text()

const html_file_loader = new HtmlLoader({ path: fromFileUrl(html_file_path) })
const js_txt = await html_file_loader.parseToJs(html_file_content)

const results = await esbuild.build({
	absWorkingDir: fromFileUrl(this_dir_path),
	format: "esm",
	target: "esnext",
	platform: "browser",
	stdin: {
		contents: js_txt,
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

const js_compiled_text = results.outputFiles[0].text
const html_compiled_text = await html_file_loader.unparseFromJs(js_compiled_text)
console.log("%c" + "bundled html file output:", "color: green; font-weight: bold;")
console.log(html_compiled_text)
results.outputFiles.slice(1).forEach((js_file, index) => {
	console.log("%c" + `bundled js file: ${index}`, "color: green; font-weight: bold;")
	console.log(js_file.text)
})
