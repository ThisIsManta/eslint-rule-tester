import { test } from '../main.ts'

export default test({
	rules: {
		'foo': {
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
	valid: [''],
	invalid: [{ code: 'code', errors: [{ message: 'bar' }] }],
})