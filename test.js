// @ts-check

import fp from 'path'
import { RuleTester } from 'eslint'
import chalk from 'chalk'

/**
 * @typedef {{ tests?: { valid?: Array<import('eslint').RuleTester.ValidTestCase>, invalid?: Array<import('eslint').RuleTester.InvalidTestCase> } }} Tests
 */

/**
 * @param {Tests['tests'] | Array<import('eslint').RuleTester.ValidTestCase> | import('eslint').RuleTester.ValidTestCase} input
 */
// @ts-ignore
export function only(input) {
	// Support `only('...')` as in `valid: ['...']`
	if (typeof input === 'string') {
		return { code: input, only: true }
	}

	// Support `valid: only([...])` and `invalid: only([...])`
	if (Array.isArray(input)) {
		// @ts-ignore
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

// @ts-ignore
global.only = only

/**
 * @param {Array<{ filePath: string, module: any }>} fileList
 * @param {{ bail: boolean, log: (line: string) => void, err: (line: string) => void }} [options={ bail: false, log: console.log, err: console.error }]
 * @returns {number} number of non-pass test cases
 */
export default function test(
	fileList,
	{ bail, log, err } = { bail: false, log: console.log, err: console.log }
) {
	const normalizedRuleConfigList = fileList.flatMap(
		/**
		 * @return {Array<Omit<import('eslint').Linter.Config, 'rules'> & { rules: Record<string, import('eslint').Rule.RuleModule & import('./test.js').Tests> }>}
		 */
		({ filePath, module }) => {
			const fileName = fp.basename(filePath, fp.extname(filePath))

			if (
				typeof module === 'object' &&
				module &&
				'rules' in module &&
				typeof module.rules === 'object' &&
				module.rules &&
				Object.values(module.rules).every(ruleModule => typeof ruleModule === 'object' && ruleModule && 'create' in ruleModule)
			) {
				const pluginName = module.meta?.name ?? module.name ?? fileName

				const language = Object.keys(module.languages || {})[0]

				return [{
					plugins: { [pluginName]: module },
					language: language ? pluginName + '/' + language : undefined,
					rules: Object.fromEntries(
						Object.entries(module.rules)
							.map(([ruleName, ruleModule]) => {
								return [pluginName + '/' + ruleName, ruleModule]
							})
					),
				}]

			} else if (
				typeof module === 'object' && module &&
				'create' in module &&
				typeof module.create === 'function'
			) {
				return [{
					rules: { [fileName]: module }
				}]

			} else if (Array.isArray(module)) {
				const configs = /** @type {Array<import('eslint').Linter.Config>} */ (module)
				return configs.map(({ rules, ...config }) => ({
					...config,
					rules: Object.keys(rules || {}).reduce(
						/**
						 * @param {Record<string, import('eslint').Rule.RuleModule & import('./test.js').Tests>} rules 
						 */
						(rules, name) => {
							const [pluginName, ruleName] = name.split('/')

							const ruleModule = config.plugins?.[pluginName]?.rules?.[ruleName]
							if (typeof ruleModule === 'object' && ruleModule) {
								rules[name] = ruleModule
							}

							return rules
						}, {}),
				}))

			} else {
				throw new Error(`Expected file "${filePath}" to be an ESLint plugin or rule.`)
			}
		}
	)

	const oneOrMoreTestCaseIsSkipped = normalizedRuleConfigList
		.flatMap(config => Object.values(config.rules))
		.some(ruleModule =>
			ruleModule.tests?.valid?.some(testCase =>
				typeof testCase === 'object' && testCase.only
			) ||
			ruleModule.tests?.invalid?.some(testCase =>
				testCase.only
			)
		)

	const ruleList = normalizedRuleConfigList
		.flatMap(({ rules, ...config }) =>
			Object.entries(rules)
				.map(([ruleName, ruleModule]) =>
					({ ruleName, ruleModule, config })
				))
		.map(({ ruleName, ruleModule, config }) => {
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

			/** @type {keyof typeof config} */
			let key
			for (key in config) {
				if (config[key] === undefined) {
					delete config[key]
				}
			}

			return {
				ruleName,
				ruleModule,
				config,
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

	for (const { ruleName, ruleModule, config, totalTestCases, selectTestCases } of ruleList) {
		if (totalTestCases.length === 0) {
			log('⚪ ' + ruleName + ` (0)`)
			continue
		}

		stats.skip += totalTestCases.length - selectTestCases.length

		if (selectTestCases.length === 0) {
			log('⏩ ' + ruleName + ` (${totalTestCases.length.toLocaleString()})`)
			continue
		}

		/**
			* @type {Array<import('eslint').RuleTester.ValidTestCase & { error: string }>} failures
			*/
		const failures = []
		for (const { only, ...testCase } of selectTestCases) {
			try {
				new RuleTester(
					Object.keys(config).length > 0
						? config
						: {
							languageOptions: {
								ecmaVersion: 'latest',
								sourceType: 'module',
							}
						}
				).run(
					ruleName,
					ruleModule,
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

				err(chalk.red(format(3, error)))

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
