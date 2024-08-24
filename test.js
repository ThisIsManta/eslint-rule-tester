// @ts-check

import { RuleTester } from 'eslint'
import chalk from 'chalk'

/**
 * @typedef {{ tests: { valid?: Array<import('eslint').RuleTester.ValidTestCase>, invalid?: Array<import('eslint').RuleTester.InvalidTestCase> } }} Tests
 */

/**
 * @param {Tests['tests'] | Array<import('eslint').RuleTester.ValidTestCase> | import('eslint').RuleTester.ValidTestCase} input
 */
export function only(input) {
	// Support `only('...')` as in `valid: ['...']`
	if (typeof input === 'string') {
		return { code: input, only: true }
	}

	// Support `valid: only([...])` and `invalid: only([...])`
	if (Array.isArray(input)) {
		return input.map(testCase => only(testCase))
	}

	if (typeof input === 'object' && input !== null) {
		if ('code' in input) {
			return { ...input, only: input.only ?? true }
		} else {
			// Support `tests: { valid: ..., invalid: ... }`
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

global.only = only

/**
 * @param {Record<string, import('eslint').Rule.RuleModule & Tests>} rules
 * @param {{ bail: boolean, log: (line: string) => void, err: (line: string) => void }} [options={ bail: false, log: console.log, err: console.error }]
 * @returns {number} number of non-pass test cases
 */
export default function test(
	rules,
	{ bail, log, err } = { bail: false, log: console.log, err: console.log }
) {
	// See https://eslint.org/docs/latest/integrate/nodejs-api#ruletester
	const tester = new RuleTester({
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
		}
	})

	const oneOrMoreTestCaseIsSkipped = Object.values(rules).some(ruleModule =>
		ruleModule.tests?.valid?.some(testCase =>
			typeof testCase === 'object' && testCase.only
		) ||
		ruleModule.tests?.invalid?.some(testCase =>
			testCase.only
		)
	)

	const ruleList = Object.entries(rules).map(([ruleName, ruleModule]) => {
		/**
		 * @type {Array<import('eslint').RuleTester.ValidTestCase | import('eslint').RuleTester.InvalidTestCase>}
		 */
		const totalTestCases = [
			...(ruleModule.tests?.valid || []).map(testCase =>
				typeof testCase === 'string' ? { code: testCase } : testCase
			),
			...(ruleModule.tests?.invalid || []),
		]

		const selectTestCases = totalTestCases.filter(testCase =>
			oneOrMoreTestCaseIsSkipped ? testCase.only : true
		)

		return {
			ruleName,
			ruleModule,
			totalTestCases,
			selectTestCases,
		}
	})

	// Put rules that have zero and all-skipped test cases at the top respectively
	ruleList.sort((left, right) => {
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

	const stats = { pass: 0, fail: 0, skip: 0 }

	for (const { ruleName, ruleModule, totalTestCases, selectTestCases } of ruleList) {
		if (totalTestCases.length === 0) {
			log('*️⃣ ' + ruleName + ` (0)`)
			continue
		}

		stats.skip += totalTestCases.length - selectTestCases.length

		if (selectTestCases.length === 0) {
			log('⏩ ' + ruleName + ` (${totalTestCases.length.toLocaleString()})`)
			continue
		}

		/**
			* @type {Array<import('eslint').RuleTester.ValidTestCase & { error: Error }>} failures
			*/
		const failures = []
		for (const { only, ...testCase } of selectTestCases) {
			try {
				tester.run(
					ruleName,
					ruleModule,
					// Run one test case at a time
					'errors' in testCase
						? { valid: [], invalid: [testCase] }
						: { valid: [testCase], invalid: [] }
				)

			} catch (error) {
				failures.push({ ...testCase, error })

				if (bail) {
					break
				}
			}
		}

		if (failures.length > 0) {
			err('🔴 ' + ruleName + ` (${failures.length.toLocaleString()}/${totalTestCases.length.toLocaleString()})`)

			for (let index = 0; index < failures.length; index++) {
				err('')

				const { error, ...testCase } = failures[index]

				if (testCase.name !== undefined) {
					err('   ' + chalk.underline('name') + ': ' + testCase.name)
				}

				err('   ' + chalk.underline('code') + ': ' + format(9, testCase.code, true).trimStart())

				if (testCase.filename !== undefined) {
					err('   ' + chalk.underline('filename') + ': ' + testCase.filename)
				}

				if (testCase.options !== undefined) {
					err('   ' + chalk.underline('options') + ': ' + format(3, JSON.stringify(testCase.options, null, 2)).trimStart())
				}

				err(chalk.red(format(3, error.message)))

				if (bail) {
					return 1
				}
			}

			log('')

		} else if (totalTestCases.length === selectTestCases.length) {
			log('🟢 ' + ruleName + ` (${totalTestCases.length.toLocaleString()})`)

		} else {
			log('🟡 ' + ruleName + ` (${selectTestCases.length.toLocaleString()}/${totalTestCases.length.toLocaleString()})`)
		}

		stats.pass += selectTestCases.length - failures.length
		stats.fail += failures.length
	}

	log('')

	if (stats.skip > 0) {
		log(chalk.bgHex('#0CAAEE')(chalk.white.bold(' SKIP ')) + ' ' + stats.skip.toLocaleString())
	}

	log(chalk.bgGreen(chalk.white.bold(' PASS ')) + ' ' + stats.pass.toLocaleString())

	if (stats.fail > 0) {
		log(chalk.bgRed(chalk.white.bold(' FAIL ')) + ' ' + stats.fail.toLocaleString())
	}

	if (Object.values(stats).every(count => count === 0)) {
		return -1
	}

	return stats.fail + stats.skip
}

/**
 * @param {number} offset
 * @param {string} text
 * @param {(line: string) => string} [decorateLine=line => line]
 */
function format(offset, text, lineNumberVisible = false, decorateLine = line => line) {
	const lines = text.split('\n')
	const lineNumberDigitCount = lines.length.toString().length
	return lines.map((line, lineIndex) => {
		const lineNumber = lineNumberVisible
			? chalk.blue((lineIndex + 1).toString().padStart(lineNumberDigitCount, ' ')) + ' '
			: ''
		return ' '.repeat(offset) + lineNumber + decorateLine(line)
	}).join('\n')
}
