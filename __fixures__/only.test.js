import { test } from '../main.ts'

export default test({
	meta: { name: 'plugin' },
	rules: {
		'only': {
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
	valid: [{ code: '' }],
	invalid: [{ only: true, code: 'void(0)', errors: [{ message: 'bar' }] }],
})