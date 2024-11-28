import { math_min } from "./deps.ts"


const escape_regex_chars_regex = /[.*+?^${}()|[\]\\]/g

/** escape a string so that it can be matched exactly in a regex constructor.
 * 
 * @example
 * ```ts
 * const
 * 	substring = "(++h.e.l.l.o++)",
 * 	my_regex = new RegExp(`${substring}\(world\)`),
 * 	my_str = "this string consist of (++h.e.l.l.o++)(world) positioned somewhere in the middle"
 * console.assert(my_regex.test(my_str) === true)
 * ```
*/
export const escapeStringForRegex = (str: string): string => (str.replaceAll(escape_regex_chars_regex, "\\$&"))

/** create a mapping function that operates on a list or array inputs that are zipped together as tuples. */
export const zipArraysMapperFactory = <T extends Array<any>, V>(
	map_fn: ((tuple: T, index: number) => V)
): ((...arrays: Array<any[]>) => Array<V>) => {
	return (...arrays: Array<any[]>): Array<V> => {
		const
			output: Array<V> = [],
			min_len = math_min(...arrays.map((arr) => (arr.length)))
		for (let i = 0; i < min_len; i++) {
			output.push(map_fn(
				arrays.map((arr) => arr[i]) as T,
				i,
			))
		}
		return output
	}
}

/** zip together a list of input arrays as tuples, similar to python's `zip` function. */
export const zipArrays = <T extends Array<any>>(...arrays: Array<any[]>): Array<T> => {
	const
		output: Array<T> = [],
		min_len = math_min(...arrays.map((arr) => (arr.length)))
	for (let i = 0; i < min_len; i++) {
		output.push(arrays.map((arr) => arr[i]) as T)
	}
	return output
}
