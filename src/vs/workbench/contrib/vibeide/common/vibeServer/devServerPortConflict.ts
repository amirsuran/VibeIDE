/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * Detection of "the port this project wanted is busy" in dev-server output. Frameworks either
 * fall back to another port after printing a warning (Next/Vite/Angular/CRA) or crash with
 * `EADDRINUSE` (bare Node servers). Both shapes surface the busy port in the output — this
 * helper extracts it so the orchestrator can offer to free the port. Pure function, no imports.
 */

/**
 * Framework warnings, most specific first:
 *  - Next:    "Port 3000 is in use, trying 3001 instead." / "… using available port 3001 instead."
 *  - Vite:    "Port 5173 is in use, trying another one..."
 *  - Angular: "Port 4200 is already in use."
 *  - CRA:     "Something is already running on port 3000."
 *  - Node:    "Error: listen EADDRINUSE: address already in use 127.0.0.1:3000" / ":::3000"
 */
const BUSY_PORT_PATTERNS: readonly RegExp[] = [
	/\bport\s+(?<port>\d{1,5})\s+is\s+(?:already\s+)?in\s+use\b/i,
	/\balready\s+running\s+on\s+port\s+(?<port>\d{1,5})\b/i,
	/\bEADDRINUSE\b.*:(?<port>\d{1,5})\b/i,
];

/**
 * Extracts the busy port from a chunk of dev-server output, or `undefined` when the chunk
 * carries no recognizable port-conflict message.
 */
export function detectBusyPort(output: string): number | undefined {
	for (const pattern of BUSY_PORT_PATTERNS) {
		const match = pattern.exec(output);
		const port = match?.groups?.port ? Number(match.groups.port) : undefined;
		if (port !== undefined && port >= 1 && port <= 65535) {
			return port;
		}
	}
	return undefined;
}
