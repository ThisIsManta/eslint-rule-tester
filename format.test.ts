import { vi, afterEach, it, expect } from 'vitest'

import format from './format.ts'

it('returns leading spaces at the beginning of each line', () => {
	expect(format(2, `line 1
line 2
line 3`)).toBe(`  line 1
  line 2
  line 3`)
})

it('returns line numbers at the beginning of each line', () => {
	expect(format(2, `line 1
line 2
line 3`, true)).toBe(`  1 line 1
  2 line 2
  3 line 3`)
})

it('returns the result of the decorator for each line', () => {
	expect(format(2, `line 1
line 2
line 3`, true, (line) => '"' + line + '"')).toBe(`  1 "line 1"
  2 "line 2"
  3 "line 3"`)
})