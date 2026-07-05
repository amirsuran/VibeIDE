/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


// Desktop-only twin of `browser/vibeLogConfigContribution.ts`: mirrors the resolved
// `vibeide.logging.*` snapshot + the `vibeide.secretDetection` config into electron-main
// over VIBE_LOG_ADMIN_CHANNEL, so main's vibeLog stops running on `VIBE_LOG*` env-var
// defaults and its log sinks redact secrets too (main builds the redactor locally from
// the shared pure `redactSecretsInObject` — functions cannot cross IPC, config can).

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ISecretDetectionService } from '../common/secretDetectionService.js';
import { SecretDetectionConfig } from '../common/secretDetection.js';
import { IVibeLogAdminMain, VIBE_LOG_ADMIN_CHANNEL } from '../common/vibeLogAdminIpc.js';
import { readVibeLoggingInput } from '../browser/vibeLogConfigContribution.js';

class VibeLogMainSyncContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.vibeLogMainSync';

	private readonly _mainProxy: IVibeLogAdminMain;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ISecretDetectionService private readonly secretDetectionService: ISecretDetectionService,
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		super();
		this._mainProxy = ProxyChannel.toService<IVibeLogAdminMain>(mainProcessService.getChannel(VIBE_LOG_ADMIN_CHANNEL));
		this.push();
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('vibeide.logging')) {
				this.push();
			}
		}));
		// Secret-detection config feeds main's redactor — re-push when it changes (the
		// renderer's own redactor reads getConfig() live, so no local re-apply is needed).
		this._register(this.secretDetectionService.onDidChangeConfig(() => this.push()));
	}

	/** Fire-and-forget: logging must never block or break the workbench. */
	private push(): void {
		let secretDetection: SecretDetectionConfig | null = null;
		try {
			secretDetection = this.secretDetectionService.getConfig();
		} catch { /* keep null — main runs without redactor rather than failing the push */ }
		void this._mainProxy.applyConfig({ logging: readVibeLoggingInput(this.configurationService), secretDetection })
			.catch(() => { /* main not ready / shutting down — next change re-pushes */ });
	}
}

registerWorkbenchContribution2(VibeLogMainSyncContribution.ID, VibeLogMainSyncContribution, WorkbenchPhase.AfterRestored);
