A command-line interface for running [ESLint rule unit tests](https://eslint.org/docs/latest/extend/custom-rules#rule-unit-tests) powered by the official [RuleTester](https://eslint.org/docs/latest/integrate/nodejs-api#ruletester) API.

## Running the unit tests

```sh
npm exec eslint-rule-tester <...path>
```
where `<...path>` is one or more [Glob patterns](https://www.npmjs.com/package/glob#Glob-Primer), which can be mixed of..
- JavaScript file exporting [ESLint plugin](https://eslint.org/docs/latest/extend/plugins), for example,  
	```js
	module.exports = {
		// See https://eslint.org/docs/latest/extend/plugins#creating-a-plugin
		rules: {
			'rule-name': {
				// See https://eslint.org/docs/latest/extend/custom-rules#rule-structure
				tests: { valid: [], invalid: [] }
			}
		}
	}
	```
- JavaScript file exporting [ESLint rule](https://eslint.org/docs/latest/extend/custom-rules), for example,  
	```js
	module.exports = {
		// See https://eslint.org/docs/latest/extend/custom-rules#rule-structure
		tests: { valid: [], invalid: [] }
	}
	```

The command returns the status code representing the number of **non-pass** test results.

Optionally, the command accepts the following arguments:

|Argument|Description|
|---|---|
|`--bail`|Stop at the first failing test case.|
|`--silent`|Print only failing test cases to the standard output.|

## Running exclusive test cases

To run fewer test cases for debugging purposes, choose one of the following approaches:
- Set `only: true` in your test case as mentioned in [ESLint official documentations](https://eslint.org/docs/latest/integrate/nodejs-api#ruletester), for example,
	```js
	module.exports = {
		tests: {
			valid: [
				{
					only: true,
					code: '...'
				}
			],
			invalid: [...]
		}
	}
	```
- Wrap your test case with the global function `only` injected by this package, for example,
	```js
	module.exports = {
		tests: {
			valid: [
				only({
					code: '...'
				})
			],
			invalid: []
		}
	}
	```
- Wrap `valid` and/or `invalid` arrays with the global function `only` injected by this package, for example,
	```js
	module.exports = {
		tests: {
			valid: only([
				{
					code: '...'
				}
			]),
			invalid: only([])
		}
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