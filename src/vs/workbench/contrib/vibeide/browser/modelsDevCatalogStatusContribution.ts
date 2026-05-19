/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { URI } from '../../../../base/common/uri.js';
import { IModelsDevCatalogStatusService } from '../common/modelsDevCatalogStatusService.js';

/**
 * On startup, asks main-process whether the models.dev catalog loaded successfully.
 * Triggers the lazy first fetch as a side-effect — useful as a prefetch so the catalog
 * is ready before the user sends their first chat message.
 *
 * Notifies the user only in degraded states:
 *   - 'loaded_from_local': INFO toast (catalog is working, but came from a frozen snapshot
 *     — they should know it might be stale, especially after a new model release).
 *   - 'failed': WARNING toast with actionable instructions (download models.dev/api.json
 *     and drop it next to VibeIDE.exe or into userData). Includes an "Open URL" action.
 *
 * Why the registration-time fetch: aiSdkAdapter calls getCatalog() lazily on the first LLM
 * request. Without this prefetch, the failure toast would only fire after the user already
 * hit a broken minimax response — too late to be helpful. Doing it at AfterRestored phase
 * keeps it off the critical startup path while still warning the user before they're
 * blocked.
 */
export class ModelsDevCatalogStatusContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.modelsDevCatalogStatus';

	constructor(
		@IModelsDevCatalogStatusService statusService: IModelsDevCatalogStatusService,
		@INotificationService notificationService: INotificationService,
		@IOpenerService openerService: IOpenerService,
	) {
		super();
		// Fire-and-forget. Status check failure (IPC down etc) is non-critical.
		void this._check(statusService, notificationService, openerService);
	}

	private async _check(
		statusService: IModelsDevCatalogStatusService,
		notificationService: INotificationService,
		openerService: IOpenerService,
	): Promise<void> {
		let status;
		try {
			status = await statusService.getStatus();
		} catch (e) {
			// IPC down — nothing actionable to show. main-process console already logged.
			console.warn('[modelsDevCatalogStatus] status query failed', e);
			return;
		}

		if (status.state === 'loaded_from_network' || status.state === 'unloaded') return;

		if (status.state === 'loaded_from_local') {
			notificationService.notify({
				severity: Severity.Info,
				message:
					`VibeIDE: каталог моделей models.dev недоступен по сети — загружен локальный снимок (${status.path}). ` +
					`Aggregator-провайдеры (openCode, openCodeZen) будут работать. Чтобы обновить каталог — скачайте свежую версию ` +
					`с https://models.dev/api.json при наличии сети.`,
				sticky: false,
			});
			return;
		}

		// state === 'failed'
		const paths = status.candidatePaths.length > 0 ? status.candidatePaths.join('\n  • ') : '(нет доступных путей)';
		notificationService.notify({
			severity: Severity.Warning,
			message:
				`VibeIDE: каталог моделей models.dev недоступен по сети, локальный снимок не найден. ` +
				`Модели minimax/qwen через openCode/openCodeZen могут возвращать пустые ответы. ` +
				`Скачайте ${status.catalogUrl} и сохраните как "models.dev.json" по одному из путей:\n  • ${paths}`,
			sticky: true,
			actions: {
				primary: [
					{
						id: 'vibeide.openModelsDevUrl',
						label: 'Открыть models.dev/api.json',
						tooltip: status.catalogUrl,
						class: undefined,
						enabled: true,
						run: async () => { await openerService.open(URI.parse(status.catalogUrl)); },
					},
				],
			},
		});
	}
}

registerWorkbenchContribution2(
	ModelsDevCatalogStatusContribution.ID,
	ModelsDevCatalogStatusContribution,
	WorkbenchPhase.AfterRestored,
);
