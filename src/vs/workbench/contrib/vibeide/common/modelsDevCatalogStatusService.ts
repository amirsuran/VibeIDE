/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';

// Mirrors electron-main/llmMessage/modelsDevCatalog.ts. Duplicated here (not imported)
// because workbench-layer code can't reach into electron-main packages directly.
export type ModelsDevCatalogStatus =
	| { state: 'unloaded' }
	| { state: 'loaded_from_network' }
	| { state: 'loaded_from_local'; path: string }
	| { state: 'failed'; candidatePaths: string[]; catalogUrl: string };

export interface IModelsDevCatalogStatusService {
	readonly _serviceBrand: undefined;
	getStatus(): Promise<ModelsDevCatalogStatus>;
}

export const IModelsDevCatalogStatusService =
	createDecorator<IModelsDevCatalogStatusService>('modelsDevCatalogStatusService');

export class ModelsDevCatalogStatusService implements IModelsDevCatalogStatusService {
	readonly _serviceBrand: undefined;
	private readonly proxy: IModelsDevCatalogStatusService;

	constructor(@IMainProcessService mainProcessService: IMainProcessService) {
		this.proxy = ProxyChannel.toService<IModelsDevCatalogStatusService>(
			mainProcessService.getChannel('vibeide-channel-modelsDevCatalogStatus'),
		);
	}

	getStatus(): Promise<ModelsDevCatalogStatus> {
		return this.proxy.getStatus();
	}
}

registerSingleton(IModelsDevCatalogStatusService, ModelsDevCatalogStatusService, InstantiationType.Delayed);
