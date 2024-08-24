#!/usr/bin/env node

// @ts-check

import fp from 'path'
import pessimist from '@thisismanta/pessimist'
import test from './test.js'

const { bail, silent, ...filePathList } = pessimist.parseArguments(process.argv.slice(2), {
	bail: false,
	silent: false,
})

if (filePathList.length === 0) {
	throw new Error('Expected one or more file arguments of ESLint plugins or rules.')
}

/**
 * @type {Record<string, import('eslint').Rule.RuleModule & import('./test.js').Tests>}
 */
const rules = {}

for (const filePath of Array.from(filePathList)) {
	const module = (await import(filePath)).default

	if (typeof module !== 'object' || module === null) {
		throw new Error(`Expected "${filePath}" file to be an ESLint plugin or rule.`)
	}

	if ('rules' in module && typeof module.rules === 'object' && module.rules !== null) {
		Object.assign(rules, module.rules)
	} else {
		const dummyRuleName = fp.basename(filePath, fp.extname(filePath))
		rules[dummyRuleName] = module
	}
}

const errorCount = test(rules, {
	bail,
	log: silent ? () => { } : console.log,
	err: console.log,
})

process.exit(errorCount)
