/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { promises } from 'fs';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { basename, dirname, join } from '../../../../base/common/path.js';
import { Promises } from '../../../../base/node/pfs.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { CodeCacheEntry, selectCodeCachesToDelete } from './codeCachePruning.js';

// VibeIDE: hard cap on retained V8 code-cache folders, independent of age. Each rebuild
// mints a fresh commit-named folder; the age window (below) never trims a week of frequent
// local rebuilds because they are all younger than it. Keep the N newest, prune the rest.
const KEEP_MOST_RECENT_CODE_CACHES = 10;

export class CodeCacheCleaner extends Disposable {

	private readonly dataMaxAge: number;

	constructor(
		currentCodeCachePath: string | undefined,
		@IProductService productService: IProductService,
		@ILogService private readonly logService: ILogService
	) {
		super();

		this.dataMaxAge = productService.quality !== 'stable'
			? 1000 * 60 * 60 * 24 * 7 		// roughly 1 week (insiders)
			: 1000 * 60 * 60 * 24 * 30 * 3; // roughly 3 months (stable)

		// Cached data is stored as user data and we run a cleanup task every time
		// the editor starts. The strategy is to delete all files that are older than
		// 3 months (1 week respectively)
		if (currentCodeCachePath) {
			const scheduler = this._register(new RunOnceScheduler(() => {
				this.cleanUpCodeCaches(currentCodeCachePath);
			}, 30 * 1000 /* after 30s */));
			scheduler.schedule();
		}
	}

	private async cleanUpCodeCaches(currentCodeCachePath: string): Promise<void> {
		this.logService.trace('[code cache cleanup]: Starting to clean up old code cache folders.');

		try {
			const now = Date.now();

			// The folder which contains folders of cached data.
			// Each of these folders is partioned per commit
			const codeCacheRootPath = dirname(currentCodeCachePath);
			const currentCodeCache = basename(currentCodeCachePath);

			const codeCaches = await Promises.readdir(codeCacheRootPath);

			// Stat every folder once, then let the pure policy decide which to delete
			// (age OR count cap). Folders that fail to stat are skipped, not deleted.
			const entries: CodeCacheEntry[] = [];
			await Promise.all(codeCaches.map(async codeCache => {
				try {
					const stat = await promises.stat(join(codeCacheRootPath, codeCache));
					entries.push({ name: codeCache, mtimeMs: stat.mtime.getTime(), isDirectory: stat.isDirectory() });
				} catch (e) {
					this.logService.trace(`[code cache cleanup]: Skipping ${codeCache} (stat failed).`);
				}
			}));

			const toDelete = selectCodeCachesToDelete(entries, {
				currentCacheName: currentCodeCache,
				now,
				maxAgeMs: this.dataMaxAge,
				keepMostRecent: KEEP_MOST_RECENT_CODE_CACHES,
			});

			await Promise.all(toDelete.map(async name => {
				this.logService.trace(`[code cache cleanup]: Removing code cache folder ${name}.`);
				return Promises.rm(join(codeCacheRootPath, name));
			}));
		} catch (error) {
			onUnexpectedError(error);
		}
	}
}
