/** User-facing labels for dashboard connection modes. */
export function modeLabel(mode: string): string {
	switch (mode) {
		case "live":
			return "Live";
		case "mock":
			return "Demo";
		case "degraded":
			return "Limited";
		default:
			return mode;
	}
}
