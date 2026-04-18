#!/usr/bin/env node

import fp from 'path'
import { globSync } from 'glob'
import { pathToFileURL } from 'url'
import { styleText } from 'util'
import { parseArguments, parseBoolean } from '@thisismanta/pessimist'
import { type ESLint, RuleTester } from 'eslint'

import { isDirectory } from './file.js'
import type { Tests, Options } from './main.js'
import format from './format.js'

const { bail, silent, ...inputPathList } = parseArguments(process.argv.slice(2), {
	bail: false,
	silent: false,
})

process.env.NODE_ENV = 'test'

if (inputPathList.length === 0) {
	throw new Error('Expected one or more command-line arguments pointing to files containing ESLint plugins or rules.')
}

const fileExtensionPattern = /\.test\.((c|m)?(j|t)sx?)$/

const testPathList = Array.from(inputPathList).flatMap(inputPath => {
	if (isDirectory(inputPath)) {
		return globSync(fp.join(inputPath, '*.test.{js,jsx,ts,tsx,mjs,mts,cjs,cts}'), { absolute: true })
	}

	return [inputPath].filter(path => fileExtensionPattern.test(path))
}).map(path => pathToFileURL(path).href)

if (testPathList.length === 0) {
	throw new Error('Expected the given command-line arguments to match *.test.* file but got none.')
}

// Sort ascending as Glob does not guarantee array order
testPathList.sort()

const testSpecList: Array<{
	plugin: ESLint.Plugin,
	ruleName: string,
	testPath: string,
	tests: Tests,
	options: Options
}> = []

for (const testPath of testPathList) {
	const ruleName = fp.basename(testPath).replace(fileExtensionPattern, '')

	const { default: defaultExported } = await import(testPath)

	if (typeof defaultExported !== 'object' || defaultExported === null) {
		throw new Error(`Expected "${testPath}" to have a default export.`)
	}

	const { plugin, tests, options } = defaultExported

	if (typeof plugin.rules !== 'object' || plugin.rules === null) {
		throw new Error('Expected rules to be defined in the given plugin.')
	}

	if (typeof tests !== 'object' || tests === null || (!Array.isArray(tests.valid) && !Array.isArray(tests.invalid))) {
		throw new Error('Expected tests to have `valid` and/or `invalid` arrays.')
	}

	testSpecList.push({
		plugin,
		ruleName,
		testPath,
		tests,
		options,
	})
}

const oneOrMoreTestCaseIsSkipped = testSpecList
	.flatMap(({ tests }) => tests)
	.some(({ valid, invalid }) =>
		valid?.some(testCase =>
			typeof testCase === 'object' && testCase.only
		) ||
		invalid?.some(testCase =>
			testCase.only
		)
	)

const ruleSpecList = testSpecList.map(({ ruleName, plugin, tests, options }) => {
	const totalTestCases: Array<RuleTester.ValidTestCase | RuleTester.InvalidTestCase> = [
		...(tests.valid || []).map(testCase =>
			typeof testCase === 'string' ? { code: testCase } : testCase
		),
		...(tests.invalid || []),
	]

	const selectTestCases = totalTestCases.filter(testCase =>
		oneOrMoreTestCaseIsSkipped ? testCase.only : true
	)

	const pluginName = (plugin.meta?.name ?? plugin.name ?? 'rule-to-test').replace(/^eslint-plugin-/, '')

	const rule = plugin.rules?.[ruleName]
	if (!rule) {
		throw new Error(`Expected the rule "${ruleName}" to exist in the given plugin.`)
	}

	const language = rule.meta?.languages?.find(language => language.startsWith(pluginName + '/'))

	const tester = new RuleTester({
		plugins: { [pluginName]: plugin },
		...(language ? { language } : {}),
		...options,
	})

	return {
		ruleName,
		rule,
		tester,
		totalTestCases,
		selectTestCases,
	}
})

// Put rules that have zero and all-skipped test cases at the top respectively
ruleSpecList.sort((left, right) => {
	if (left.totalTestCases.length === 0 && right.totalTestCases.length === 0) {
		return 0
	} else if (left.totalTestCases.length === 0) {
		return -1
	} else if (right.totalTestCases.length === 0) {
		return 1
	}

	if (left.selectTestCases.length === 0 && right.selectTestCases.length === 0) {
		return 0
	} else if (left.selectTestCases.length === 0) {
		return -1
	} else if (right.selectTestCases.length === 0) {
		return 1
	}

	return 0
})

function main() {
	const log = silent ? () => { } : console.log
	const err = console.log

	const outcome = { pass: 0, fail: 0, skip: 0 }

	for (const { ruleName, rule, tester, totalTestCases, selectTestCases } of ruleSpecList) {
		if (totalTestCases.length === 0) {
			log('⚪ ' + ruleName + ` (0)`)
			continue
		}

		outcome.skip += totalTestCases.length - selectTestCases.length

		if (selectTestCases.length === 0) {
			log('⏩ ' + ruleName + ` (${totalTestCases.length.toLocaleString()})`)
			continue
		}

		const failures: Array<RuleTester.ValidTestCase & { error: string }> = []
		for (const { only, ...testCase } of selectTestCases) {
			try {
				tester.run(
					ruleName,
					rule,
					// Run one test case at a time
					'errors' in testCase
						? { valid: [], invalid: [testCase] }
						: { valid: [testCase], invalid: [] }
				)

			} catch (error) {
				failures.push({
					...testCase,
					error: (() => {
						if (error instanceof Error) {
							if ('code' in error && error.code === 'ERR_ASSERTION') {
								return error.message
							}

							return error.stack || error.message
						}

						return String(error)
					})(),
				})

				if (bail) {
					break
				}
			}
		}

		if (failures.length > 0) {
			err(`🔴 ${ruleName} (${failures.length.toLocaleString()}/${totalTestCases.length.toLocaleString()})`)

			for (const { error, ...testCase } of failures) {
				err('')

				if (testCase.name !== undefined) {
					err('   ' + styleText('underline', 'name') + ': ' + testCase.name)
				}

				err('   ' + styleText('underline', 'code') + ': ' + format(9, testCase.code, true).trimStart())

				if (testCase.filename !== undefined) {
					err('   ' + styleText('underline', 'filename') + ': ' + testCase.filename)
				}

				if (testCase.options !== undefined) {
					err('   ' + styleText('underline', 'options') + ': ' + format(3, JSON.stringify(testCase.options, null, 2)).trimStart())
				}

				err(styleText('red', format(3, error)))

				if (bail) {
					return 1
				}
			}

			log('')

		} else if (totalTestCases.length === selectTestCases.length) {
			log(`🟢 ${ruleName} (${totalTestCases.length.toLocaleString()})`)

		} else {
			log(`🟡 ${ruleName} (${selectTestCases.length.toLocaleString()}/${totalTestCases.length.toLocaleString()})`)
		}

		outcome.pass += selectTestCases.length - failures.length
		outcome.fail += failures.length
	}

	log('')

	if (outcome.skip > 0) {
		log(styleText(['bgGray', 'white', 'bold'], ' SKIP ') + ' ' + outcome.skip.toLocaleString())
	}

	log(styleText(['bgGreen', 'white', 'bold'], ' PASS ') + ' ' + outcome.pass.toLocaleString())

	if (outcome.fail > 0) {
		log(styleText(['bgRed', 'white', 'bold'], ' FAIL ') + ' ' + outcome.fail.toLocaleString())
	}

	if (Object.values(outcome).every(count => count === 0)) {
		return -1
	}

	if (parseBoolean(process.env.CI) && outcome.skip > 0) {
		log('')
		log('💥 Skipped test cases are disallowed on CI.')

		return outcome.fail + outcome.skip
	}

	return outcome.fail
}

process.exitCode = main()