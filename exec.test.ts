import { vi, afterEach, it, expect } from 'vitest'

vi.stubGlobal('console', {
	log: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
})

afterEach(() => {
	process.exitCode = undefined
	delete process.env.CI
	vi.clearAllMocks()
	vi.resetModules()
})

it('throws given an empty file', async () => {
	vi.stubGlobal('process', {
		...process,
		argv: ['', '', './__fixures__/empty.test.js'],
	})

	expect(import('./exec.ts')).rejects.toMatchObject({
		message: /Expected "file:\/\/.+\/__fixures__\/empty\.test\.js" to have a default export\./
	})
})

it('throws given no matching rule', async () => {
	vi.stubGlobal('process', {
		...process,
		argv: ['', '', './__fixures__/no-matching-rule.test.js'],
	})

	expect(import('./exec.ts')).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: Expected the rule "no-matching-rule" to exist in the given plugin.]`)
})

it('returns minus-one code, given no test cases at all', async () => {
	vi.stubGlobal('process', {
		...process,
		argv: ['', '', './__fixures__/no-tests.test.js'],
	})

	await import('./exec.ts')

	expect(process.exitCode).toBe(-1)
	expect(console.log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"⚪ no-tests (0)

		 PASS  0"
	`)
})

it('returns zero code, given all passing test case', async () => {
	vi.stubGlobal('process', {
		...process,
		argv: ['', '', './__fixures__/passing.test.js'],
	})

	await import('./exec.ts')

	expect(process.exitCode).toBe(0)
	expect(console.log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🟢 passing (3)

		 PASS  3"
	`)
})

it('returns non-zero code, given no passing test case', async () => {
	vi.stubGlobal('process', {
		...process,
		argv: ['', '', './__fixures__/failing.test.js'],
	})

	await import('./exec.ts')

	expect(process.exitCode).toBe(2)
	expect(console.log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🔴 failing (2/2)

		   code: 1 void(0)
		   Should have no errors but had 1: [
		     {
		       ruleId: 'rule-to-test/failing',
		       severity: 1,
		       message: 'bar',
		       line: 1,
		       column: 1,
		       endLine: 1,
		       endColumn: 8
		     }
		   ]
		   
		   1 !== 0
		    (1 strictEqual 0)

		   code: 1 
		   Should have 1 error but had 0: []
		   
		   0 !== 1
		    (0 strictEqual 1)


		 PASS  0
		 FAIL  2"
	`)
})

it('returns exactly one code, given bailing out', async () => {
	vi.stubGlobal('process', {
		...process,
		argv: ['', '', './__fixures__/failing.test.js', '--bail'],
	})

	await import('./exec.ts')

	expect(process.exitCode).toBe(1)
	expect(console.log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🔴 failing (1/2)

		   code: 1 void(0)
		   Should have no errors but had 1: [
		     {
		       ruleId: 'rule-to-test/failing',
		       severity: 1,
		       message: 'bar',
		       line: 1,
		       column: 1,
		       endLine: 1,
		       endColumn: 8
		     }
		   ]
		   
		   1 !== 0
		    (1 strictEqual 0)"
	`)
})

it('runs exclusive test cases that have `only` field set to true', async () => {
	vi.stubGlobal('process', {
		...process,
		argv: ['', '', './__fixures__/only.test.js'],
		env: {
			...process.env,
			CI: 'false',
		}
	})

	await import('./exec.ts')

	expect(process.exitCode).toBe(0)
	expect(console.log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🟡 only (1/2)

		 SKIP  1
		 PASS  1"
	`)
})

it('returns non-zero code, given a skipped test case on CI', async () => {
	vi.stubGlobal('process', {
		...process,
		argv: ['', '', './__fixures__/only.test.js'],
		env: {
			...process.env,
			CI: 'true',
		}
	})

	await import('./exec.ts')

	expect(process.exitCode).toBe(1)
	expect(console.log.mock.calls.join('\n')).toMatchInlineSnapshot(`
		"🟡 only (1/2)

		 SKIP  1
		 PASS  1

		💥 Skipped test cases are disallowed on CI."
	`)
})
