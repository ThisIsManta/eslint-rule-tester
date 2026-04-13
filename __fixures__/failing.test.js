import { test } from '../main.ts'

export default test({
	meta: { name: 'plugin' },
	rules: {
		'failing': {
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
			},
		}
	}
}, {
	valid: [{ code: 'void(0)' }],
	invalid: [{ code: '', errors: [{ message: 'bar' }] }],
})