import { styleText } from 'util'

export default function format(
	offset: number,
	text: string,
	lineNumberVisible = false,
	decorateLine: (line: string) => string = (line) => line
) {
	const lines = text.split('\n')
	const lineNumberDigitCount = lines.length.toString().length
	return lines.map((line, lineIndex) => {
		const lineNumber = lineNumberVisible
			? styleText('blue', (lineIndex + 1).toString().padStart(lineNumberDigitCount, ' ')) + ' '
			: ''
		return ' '.repeat(offset) + lineNumber + decorateLine(line)
	}).join('\n')
}
