import { zipArrays } from "../../src/funcdefs.ts"
import { GenericLoader } from "../../src/loader.ts"
import type { ContentDependencies } from "../../src/typedefs.ts"



const html_src_regex = /src\s*\=\s*\"(?<link>.*?)\"/g
const template_key_wrapper_fn = (key: string) => ("\\\{" + key + "\\\}")

export class HtmlLoader extends GenericLoader {
	override async extractDeps(content: string): Promise<ContentDependencies> {
		const
			importKeys: string[] = [],
			importPaths: string[] = [],
			templated_content = content.replaceAll(html_src_regex, (full_match, group1, offset, full_string, groups) => {
				const
					unique_id = crypto.randomUUID(),
					path_link = groups.link as string
				importKeys.push(unique_id)
				importPaths.push(path_link)
				return `src="${template_key_wrapper_fn(unique_id)}"`
			})
		return {
			content: templated_content,
			importKeys,
			importPaths,
		}
	}
	override async insertDeps(dependencies: ContentDependencies): Promise<string> {
		const { content: templated_content, importKeys, importPaths } = dependencies
		let content = templated_content
		zipArrays<[string, string]>(importKeys, importPaths).forEach(([key, bundled_path]) => {
			const templated_key = template_key_wrapper_fn(key)
			content = content.replaceAll(templated_key, bundled_path)
		})
		return content
	}
}
