/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from '../../../base/common/path.js';
import { relative } from '../../../base/common/path.js';
import { FileAccess } from '../../../base/common/network.js';
import { StopWatch } from '../../../base/common/stopwatch.js';
import { IEnvironmentService } from '../../environment/common/environment.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';

export const ICSSDevelopmentService = createDecorator<ICSSDevelopmentService>('ICSSDevelopmentService');

export interface ICSSDevelopmentService {
	_serviceBrand: undefined;
	isEnabled: boolean;
	getCssModules(): Promise<string[]>;
}

export class CSSDevelopmentService implements ICSSDevelopmentService {

	declare _serviceBrand: undefined;

	private _cssModules?: Promise<string[]>;

	constructor(
		@IEnvironmentService private readonly envService: IEnvironmentService,
		@ILogService private readonly logService: ILogService
	) { }

	get isEnabled(): boolean {
		return !this.envService.isBuilt;
	}

	getCssModules(): Promise<string[]> {
		this._cssModules ??= this.computeCssModules();
		return this._cssModules;
	}

	private async computeCssModules(): Promise<string[]> {
		if (!this.isEnabled) {
			return [];
		}

		const rg = await import('@vscode/ripgrep');
		return await new Promise<string[]>((resolve) => {

			const sw = StopWatch.create();

			const chunks: Buffer[] = [];
			const basePath = FileAccess.asFileUri('').fsPath;
			const outDir = join(basePath, 'out');
			const outVs = join(outDir, 'vs');

			// Paths must be relative to `out/` (e.g. vs/workbench/.../media/foo.css) so workbench.ts
			// `new URL(cssModule, baseUrl)` matches ESM imports next to emitted .js under out/vs/.
			// gulp compile-client runs copy-vs-css: src/vs/**/*.css -> out/vs/...
			if (!existsSync(outVs)) {
				this.logService.warn('[CSS_DEV] out/vs not found — run full compile (gulp copies CSS next to JS).');
				resolve([]);
				return;
			}

			const process = spawn(rg.rgPath, ['-g', '**/*.css', '--files', '--no-ignore', outVs], {});

			process.stdout.on('data', data => {
				chunks.push(data);
			});
			process.on('error', err => {
				this.logService.error('[CSS_DEV] FAILED to compute CSS data', err);
				resolve([]);
			});
			process.on('close', () => {
				const data = Buffer.concat(chunks).toString('utf8');
				const result = data.split('\n').filter(Boolean).map(absPath => relative(outDir, absPath).replace(/\\/g, '/')).filter(rel => !!rel && rel.indexOf('vs/') === 0).sort();
				resolve(result);
				this.logService.info(`[CSS_DEV] DONE, ${result.length} css modules (${Math.round(sw.elapsed())}ms)`);
			});
		});
	}
}
