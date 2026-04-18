import type { ESLint, RuleTester } from 'eslint'
import type * as Oxlint from '@oxlint/plugins'

export type Tests = {
	valid?: Array<string | RuleTester.ValidTestCase>,
	invalid?: Array<RuleTester.InvalidTestCase>
}

export type Options = Omit<
	import('@eslint/core').ConfigObject,
	'name' | 'plugins' | 'rules'
>

export function test(plugin: ESLint.Plugin | Oxlint.Plugin, tests: Tests, options: Options = {}) {
	return { plugin, tests, options }
}

export function only(input: Tests): Tests;
export function only(input: string): RuleTester.ValidTestCase;
export function only(input: RuleTester.InvalidTestCase): RuleTester.InvalidTestCase;
export function only(input: RuleTester.ValidTestCase): RuleTester.ValidTestCase;
export function only(input: Array<RuleTester.InvalidTestCase>): Array<RuleTester.InvalidTestCase>;
export function only(input: Array<string | RuleTester.ValidTestCase>): Array<RuleTester.ValidTestCase>;
export function only(input:
	| Tests | string
	| RuleTester.InvalidTestCase
	| RuleTester.ValidTestCase
	| Array<RuleTester.InvalidTestCase>
	| Array<string | RuleTester.ValidTestCase>
):
	| Tests
	| RuleTester.InvalidTestCase
	| RuleTester.ValidTestCase
	| Array<RuleTester.InvalidTestCase>
	| Array<RuleTester.ValidTestCase> {
	// Support `only('...')` as in `valid: ['...']`
	if (typeof input === 'string') {
		return { code: input, only: true }
	}

	// Support `valid: only([...])` and `invalid: only([...])`
	if (Array.isArray(input)) {
		return input.map(testCase => only(testCase as any)) as any
	}

	if (typeof input === 'object' && input !== null) {
		if ('code' in input) {
			return { ...input, only: true }
		} else {
			// Support `only(tests: { valid: ..., invalid: ... })`
			if ('valid' in input && Array.isArray(input.valid)) {
				input.valid = only(input.valid)
			}
			if ('invalid' in input && Array.isArray(input.invalid)) {
				input.invalid = only(input.invalid)
			}
			return input
		}
	}

	return input
}
