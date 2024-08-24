#!/usr/bin/env node

// @ts-check

import fp from 'path'
import { globSync } from 'glob'
import { pathToFileURL } from 'url'
import pessimist from '@thisismanta/pessimist'
import test from './test.js'

const { bail, silent, ...inputPathList } = pessimist.parseArguments(process.argv.slice(2), {
	bail: false,
	silent: false,
})

const filePathList = globSync(Array.from(inputPathList), { absolute: true })
	.map(path => pathToFileURL(path).href)

// Sort ascending as Glob does not guarantee array order
filePathList.sort()

if (filePathList.length === 0) {
	throw new Error('Expected one or more arguments pointing to ESLint plugins or rules.')
}

/**
 * @type {Record<string, import('eslint').Rule.RuleModule & import('./test.js').Tests>}
 */
const rules = {}

for (const filePath of filePathList) {
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
