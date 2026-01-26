import { vi, afterEach, it, expect } from 'vitest'

import test from './test.js'

vi.mock('chalk', () => ({
	default: ({
		blue: (text) => text,
		red: (text) => text,
		bgRed: (text) => text,
		bgGreen: (text) => text,
		bgHex: () => (text) => text,
		white: {
			bold: (text) => text,
		},
		underline: (text) => text,
	})
}))

afterEach(() => {
	vi.clearAllMocks()
})

it('returns minus-one code, given no test case at all', () => {
	const rules = {
		foo: {
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
		},
		hoo: {
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
			tests: {
				valid: [],
				invalid: [],
			}
		}
	}

	const input = {
		filePath: 'plugin.js',
		module: {
			rules
		}
	}

	const log = vi.fn()
	const err = vi.fn()
	const errorCount = test([input], { log, err })

	expect(errorCount).toBe(-1)
	expect(log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"⚪ plugin/foo (0)
		⚪ plugin/hoo (0)

		 PASS  0"
	`)
	expect(err).not.toHaveBeenCalled()
})

it('returns zero code, given all passing test case', () => {
	const rules = {
		foo: {
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
			tests: {
				valid: [{ code: '' }],
				invalid: [{ code: 'void(0)', errors: [{ message: 'bar' }] }],
			}
		}
	}

	const input = {
		filePath: 'plugin.js',
		module: {
			rules
		}
	}

	const log = vi.fn()
	const err = vi.fn()
	const errorCount = test([input], { log, err })

	expect(errorCount).toBe(0)
	expect(log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🟢 plugin/foo (2)

		 PASS  2"
	`)
	expect(err).not.toHaveBeenCalled()
})

it('returns non-zero code, given no passing test case', () => {
	const rules = {
		foo: {
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
			tests: {
				valid: [{ code: 'void(0)' }],
				invalid: [{ code: '', errors: [{ message: 'bar' }] }],
			}
		}
	}

	const input = {
		filePath: 'plugin.js',
		module: {
			rules
		}
	}

	const log = vi.fn()
	const err = vi.fn()
	const errorCount = test([input], { log, err })

	expect(errorCount).toBe(2)
	expect(log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"

		 PASS  0
		 FAIL  2"
	`)
	expect(err.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🔴 plugin/foo (2/2)

		   code: 1 void(0)
		   Should have no errors but had 1: [
		     {
		       ruleId: 'rule-to-test/plugin/foo',
		       severity: 1,
		       message: 'bar',
		       line: 1,
		       column: 1,
		       nodeType: 'Program',
		       endLine: 1,
		       endColumn: 8
		     }
		   ]
		   
		   1 !== 0
		    (1 strictEqual 0)

		   code: 1 
		   Should have 1 error but had 0: []
		   
		   0 !== 1
		    (0 strictEqual 1)"
	`)
})

it('returns exactly one code, given bailing out', () => {
	const rules = {
		foo: {
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
			tests: {
				valid: [{ code: 'void(0)' }],
				invalid: [{ code: '', errors: [{ message: 'bar' }] }],
			}
		}
	}

	const input = {
		filePath: 'plugin.js',
		module: {
			rules
		}
	}

	const log = vi.fn()
	const err = vi.fn()
	const errorCount = test([input], { bail: true, log, err })

	expect(errorCount).toBe(1)
	expect(log.mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
	expect(err.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🔴 plugin/foo (1/2)

		   code: 1 void(0)
		   Should have no errors but had 1: [
		     {
		       ruleId: 'rule-to-test/plugin/foo',
		       severity: 1,
		       message: 'bar',
		       line: 1,
		       column: 1,
		       nodeType: 'Program',
		       endLine: 1,
		       endColumn: 8
		     }
		   ]
		   
		   1 !== 0
		    (1 strictEqual 0)"
	`)
})

it('runs exclusive test cases that have `only` field set to true', () => {
	const rules = {
		foo: {
			create: vi.fn((context) => {
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
			}),
			tests: {
				valid: [{ only: true, code: '' }, { code: 'void(0)' }],
				invalid: [],
			}
		},
	}

	const input = {
		filePath: 'plugin.js',
		module: {
			rules
		}
	}

	const log = vi.fn()
	const err = vi.fn()
	const errorCount = test([input], { log, err })

	expect(errorCount).toBe(1)
	expect(rules.foo.create).toHaveBeenCalled()
	expect(log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🟡 plugin/foo (1/2)

		 SKIP  1
		 PASS  1"
	`)
})

it('runs exclusive test cases that are wrapped with `only` function', () => {
	const rules = {
		foo: {
			create: vi.fn((context) => {
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
			}),
			tests: {
				valid: [only(''), only({ code: '' }), { code: 'void(0)' }],
				invalid: [{ code: 'void(0)', errors: 1 }],
			}
		},
		goo: {
			create: vi.fn((context) => {
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
			}),
			tests: {
				valid: only(['', { code: '' }]),
				invalid: only([{ code: 'void(0)', errors: 1 }]),
			}
		},
		hoo: {
			create: vi.fn((context) => {
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
			}),
			tests: only({
				valid: ['', { code: '' }],
				invalid: [{ code: 'void(0)', errors: 1 }],
			})
		},
		loo: {
			create: vi.fn(),
			tests: {
				valid: [{ code: '' }, { code: 'void(0)' }],
				invalid: [{ code: 'void(0)', errors: 1 }],
			}
		}
	}

	const input = {
		filePath: 'plugin.js',
		module: {
			rules
		}
	}

	const log = vi.fn()
	const err = vi.fn()
	const errorCount = test([input], { log, err })

	expect(errorCount).toBe(5)
	expect(rules.foo.create).toHaveBeenCalled()
	expect(rules.goo.create).toHaveBeenCalled()
	expect(rules.hoo.create).toHaveBeenCalled()
	expect(rules.loo.create).not.toHaveBeenCalled()
	expect(log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"⏩ plugin/loo (3)
		🟡 plugin/foo (2/4)
		🟢 plugin/goo (3)
		🟢 plugin/hoo (3)

		 SKIP  5
		 PASS  8"
	`)
})

it('supports string in valid test cases', () => {
	const rules = {
		foo: {
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
			tests: {
				valid: [
					'',
					{ code: '' }
				],
			}
		}
	}

	const input = {
		filePath: 'plugin.js',
		module: {
			rules
		}
	}

	const log = vi.fn()
	const err = vi.fn()
	const errorCount = test([input], { log, err })

	expect(errorCount).toBe(0)
	expect(log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🟢 plugin/foo (2)

		 PASS  2"
	`)
	expect(err).not.toHaveBeenCalled()
})

it('accepts rules, plugins and configs as inputs', () => {
	const rules = {
		foo: {
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
			tests: {
				valid: [
					{ code: '' }
				],
			}
		}
	}

	const rule = {
		filePath: 'rule.js',
		module: rules.foo
	}

	const plugin = {
		filePath: 'plugin.js',
		module: {
			meta: { name: 'plugin' },
			rules
		}
	}

	const config = {
		filePath: 'eslint.config.js',
		module: [{
			plugins: {
				ghost: plugin.module
			},
			rules: {
				'ghost/foo': 'error'
			}
		}]
	}

	const log = vi.fn()
	const err = vi.fn()
	const errorCount = test([rule, plugin, config], { log, err })

	expect(errorCount).toBe(0)
	expect(log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🟢 rule (1)
		🟢 plugin/foo (1)
		🟢 ghost/foo (1)

		 PASS  3"
	`)
	expect(err).not.toHaveBeenCalled()
})
