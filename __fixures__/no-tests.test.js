import { test } from '../main.ts'

export default test({
	rules: {
		'no-tests': {
			create(context) {
				return {
					Program(node) {
						if (node.body.length > 0) {
							context.report({
								node,
								message: 'bar'
							})
						}
					}
				}
			}
		}
	}
}, {
	valid: [],
	invalid: [],
})