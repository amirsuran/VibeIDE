/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


/**
 * Receiver of the renderer's logging-config push (see `common/vibeLogAdminIpc.ts`): applies
 * `vibeide.logging.*` to main's `vibeLog` singleton and installs a secret redactor built from
 * the shared pure `redactSecretsInObject` + the pushed `vibeide.secretDetection` snapshot.
 * Until the first push, main keeps its `VIBE_LOG*` env-var defaults (dev escape hatch);
 * after it, settings win — same precedence the renderer itself uses.
 */

import { vibeLog } from '../common/vibeLog.js';
import { redactSecretsInObject } from '../common/secretDetection.js';
import { IVibeLogAdminMain, VibeLogMainConfig } from '../common/vibeLogAdminIpc.js';

export class VibeLogAdminMainService implements IVibeLogAdminMain {

	async applyConfig(config: VibeLogMainConfig): Promise<void> {
		vibeLog.configure(config.logging);
		const secretConfig = config.secretDetection;
		if (secretConfig?.enabled) {
			vibeLog.setRedactor(args => {
				try {
					const r = redactSecretsInObject(args as unknown[], secretConfig);
					return r.hasSecrets ? r.redacted : args;
				} catch {
					return args; // redaction must never break logging
				}
			});
		} else {
			vibeLog.setRedactor(undefined);
		}
	}
}
