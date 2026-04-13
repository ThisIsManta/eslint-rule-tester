import { describe, it, expect } from 'vitest'
import { only } from './main.ts'

describe(only, () => {
	it('sets `only: true` to a valid test case', () => {
		expect(only('code')).toEqual({ code: 'code', only: true })
		expect(only({ code: 'code' })).toHaveProperty('only', true)
		expect(only({ code: 'code', only: false })).toHaveProperty('only', true)
	})

	it('sets `only: true` to an invalid test case', () => {
		expect(only({ code: 'code', errors: [{ message: 'error' }] })).toHaveProperty('only', true)
	})

	it('sets `only: true` to a list of test cases', () => {
		expect(only([
			'code',
			{ code: 'code2' }
		])).toMatchObject([
			{ code: 'code', only: true },
			{ code: 'code2', only: true }
		])
		expect(only([
			{ code: 'code', errors: [{ message: 'error' }] }
		])).toHaveProperty('0.only', true)
	})

	it('sets `only: true` to an entire test spec', () => {
		const tests = {
			valid: ['code', { code: 'code2' }],
			invalid: [{ code: 'code3', errors: [{ message: 'error' }] }]
		}
		expect(only(tests)).toMatchInlineSnapshot(`
			{
			  "invalid": [
			    {
			      "code": "code3",
			      "errors": [
			        {
			          "message": "error",
			        },
			      ],
			      "only": true,
			    },
			  ],
			  "valid": [
			    {
			      "code": "code",
			      "only": true,
			    },
			    {
			      "code": "code2",
			      "only": true,
			    },
			  ],
			}
		`)
	})
})