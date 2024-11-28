import { zipArrays } from "../../src/funcdefs.ts"
import { GenericLoader } from "../../src/loader.ts"
import type { ContentDependencies } from "../../src/typedefs.ts"


type CustomKey = { uuid: string }

const html_src_regex = /src\s*\=\s*\"(?<link>.*?)\"/g
const template_key_wrapper_fn = (key: string) => ("\\\{" + key + "\\\}")

export class HtmlLoader extends GenericLoader<CustomKey> {
	override async extractDeps(content: string): Promise<ContentDependencies<CustomKey>> {
		const
			importKeys: CustomKey[] = [],
			importPaths: string[] = [],
			templated_content = content.replaceAll(html_src_regex, (full_match, group1, offset, full_string, groups) => {
				const
					unique_id = crypto.randomUUID(),
					path_link = groups.link as string
				importKeys.push({ uuid: unique_id })
				importPaths.push(path_link)
				return `src="${template_key_wrapper_fn(unique_id)}"`
			})
		return {
			content: templated_content,
			importKeys,
			importPaths,
		}
	}
	override async insertDeps(dependencies: ContentDependencies<CustomKey>): Promise<string> {
		const { content: templated_content, importKeys, importPaths } = dependencies
		let content = templated_content
		zipArrays<[CustomKey, string]>(importKeys, importPaths).forEach(([key, bundled_path]) => {
			const templated_key = template_key_wrapper_fn(key.uuid)
			content = content.replaceAll(templated_key, bundled_path)
		})
		return content
	}
}
