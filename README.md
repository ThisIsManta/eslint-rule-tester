A command-line interface for running [ESLint rule unit tests](https://eslint.org/docs/latest/extend/custom-rules#rule-unit-tests) powered by the official [RuleTester](https://eslint.org/docs/latest/integrate/nodejs-api#ruletester) API.

## Running the test

```sh
npm install eslint-rule-tester

npm exec eslint-rule-tester -- [--bail] [--silent] <...path>
```
Where `<...path>` is one or more [Glob patterns](https://www.npmjs.com/package/glob#Glob-Primer) pointing to `rule-name.test.js` files that look like the below.

```js
import { test } from 'eslint-rule-tester'

// See https://eslint.org/docs/latest/extend/plugins#creating-a-plugin
const plugin = {
	meta: {
		name: 'my-plugin'
	},
	rules: {
		// ⚠️ The name of the file must match the rule name here.
		'rule-name': {
			create(context) {
				// Your rule goes here
			}
		}
	}
}

// See https://eslint.org/docs/latest/extend/custom-rules#rule-structure
const tests = {
	valid: [],
	invalid: []
}

// This represents the base configurations for the tests above.
const options = {
	// The below is the default.
	languageOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
	}
}

// The `test` function wraps the arguments into an object and provides type checking only.
export default test(plugin, tests, options)
```

The command returns the status code representing the number of **non-passing** test results.

## Running selective test cases

To run fewer test cases for debugging purposes, choose one of the following approaches:
- Manually set `only: true` in your test case as mentioned in [ESLint official documentation](https://eslint.org/docs/latest/integrate/nodejs-api#ruletester), for example,
	```js
	const tests = {
		valid: [
			{
				code: '...',
				only: true
			}
		],
		invalid: [...]
	}
	```
- Wrap your test case(s) with the function `only` imported from this package, for example,
	```js
	import { only } from 'eslint-rule-tester'

	const tests = {
		valid: [
			only({
				code: '...'
			})
		],
		invalid: only([...]) // This works too.
	}
	```

## Sample command-line output

```
⚪ import-path-from-closest-index
🟢 react-sort-props
🔴 require-name-after-file-name

 1 var something = require("./james-arthur")
	 filename: ./rules/require-name-after-file-name.js
	 options: [
		 [
			 "./rules/*.js"
		 ]
	 ]
	 Should have 1 error but had 0: [] (0 strictEqual 1)

 SKIP  1
 PASS  1
 FAIL  1
```