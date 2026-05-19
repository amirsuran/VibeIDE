/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getCatalogStatus, ModelsDevCatalogStatus } from './llmMessage/modelsDevCatalog.js';

/**
 * Thin IPC-friendly wrapper around `modelsDevCatalog.getCatalogStatus()`. Lives in
 * electron-main; the renderer reaches it via ProxyChannel (see modelsDevCatalogStatusService.ts
 * in common/ and the channel registration in registerVibeideMainChannels.ts).
 *
 * Sole reason this file exists separately: ProxyChannel.fromService expects a class
 * with discoverable methods, and we want the renderer-side surface to be intentional
 * (just `getStatus()` for now), not whatever modelsDevCatalog incidentally exports.
 */
export class ModelsDevCatalogStatusMainService {
	async getStatus(): Promise<ModelsDevCatalogStatus> {
		return getCatalogStatus();
	}
}
