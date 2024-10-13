#!/usr/bin/env node

// @ts-check

import { globSync } from 'glob'
import { pathToFileURL } from 'url'
import pessimist from '@thisismanta/pessimist'
import test from './test.js'

const { bail, silent, ...inputPathList } = pessimist.parseArguments(process.argv.slice(2), {
	bail: false,
	silent: false,
})

if (inputPathList.length === 0) {
	throw new Error('Expected one or more command-line arguments pointing to files containing ESLint plugins or rules.')
}

const filePathList = globSync(Array.from(inputPathList), { absolute: true })
	.map(path => pathToFileURL(path).href)

if (filePathList.length === 0) {
	throw new Error('Expected the given command-line arguments to match at least a JavaScript file but got none.')
}

// Sort ascending as Glob does not guarantee array order
filePathList.sort()

const fileList = await Promise.all(
	filePathList.map(async (filePath) => {
		const module = (await import(filePath)).default
		return { filePath, module }
	})
)

const errorCount = test(
	fileList,
	{
		bail,
		log: silent ? () => { } : console.log,
		err: console.log,
	}
)

process.exit(errorCount)
