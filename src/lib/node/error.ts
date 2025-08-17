export function doesErrorMatchNodeCode(error: unknown, code: string): boolean {
	return (
		error != null &&
		typeof error === "object" &&
		"code" in error &&
		error.code === code
	);
}
