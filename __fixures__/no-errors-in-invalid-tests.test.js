import { test } from '../main.ts'

export default test({
	rules: {
		'no-errors-in-invalid-tests': {
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
	valid: [{ code: '' }],
	invalid: [{ code: '' }],
})