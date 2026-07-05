/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * IPC contract for pushing the renderer-resolved logging config into the MAIN process'
 * `vibeLog` singleton. Each process owns its own singleton; the renderer bridges settings
 * locally (`vibeLogConfigContribution.ts`) and mirrors the same snapshot here so main stops
 * running on env-var defaults (`VIBE_LOG*`) and its sinks redact secrets too. Pure data +
 * signatures; no browser/node imports.
 */

import { VibeLogConfigInput } from './vibeLog.js';
import { SecretDetectionConfig } from './secretDetection.js';

export const VIBE_LOG_ADMIN_CHANNEL = 'vibeide-channel-vibeLogAdmin';

export interface VibeLogMainConfig {
	/** `vibeide.logging.*` snapshot — same shape the renderer feeds its own `vibeLog.configure`. */
	readonly logging: VibeLogConfigInput;
	/**
	 * `vibeide.secretDetection` snapshot for building main's redactor from the shared pure
	 * `redactSecretsInObject` (functions cannot cross IPC — config can). `null` → no redaction.
	 */
	readonly secretDetection: SecretDetectionConfig | null;
}

export interface IVibeLogAdminMain {
	/** Applies the snapshot to main's `vibeLog` (config + secret redactor). Idempotent. */
	applyConfig(config: VibeLogMainConfig): Promise<void>;
}
