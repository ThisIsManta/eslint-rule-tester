import fs from 'fs'

export function isDirectory(path: string): boolean {
	return fs.lstatSync(path).isDirectory()
}