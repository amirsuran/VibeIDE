/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * VibeUnexpectedErrorLoggingContribution.
 *
 * Global unexpected errors flow through core `onUnexpectedError` → the user sees a generic
 * "Произошла неизвестная ошибка. Подробности — в журнале" notification, but the actual
 * message/stack was NOT written to a place the user can easily retrieve (the renderer console
 * shows it, but the "copy logs" affordance reads the ILogService journal). This contribution
 * registers an additional listener on the shared error handler and writes the full detail to
 * the log so "Подробности — в журнале" actually holds them.
 *
 * Non-invasive: `addListener` runs ALONGSIDE the existing default handler (which still rethrows
 * for telemetry); we only observe. The listener swallows its own failures so the error sink can
 * never throw recursively.
 */

import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { errorHandler } from '../../../../base/common/errors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';

class VibeUnexpectedErrorLoggingContribution extends Disposable {

	constructor(
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._register(toDisposable(errorHandler.addListener(err => {
			try {
				if (!err) { return; }
				let detail: string;
				if (err instanceof Error) {
					detail = err.stack || `${err.name}: ${err.message}`;
				} else if (typeof err === 'string') {
					detail = err;
				} else {
					try { detail = JSON.stringify(err); } catch { detail = String(err); }
				}
				this._logService.error(`[VibeIDE/unexpected] ${detail}`);
			} catch {
				// The error sink must never throw — a failure here would recurse through onUnexpectedError.
			}
		})));
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	VibeUnexpectedErrorLoggingContribution,
	LifecyclePhase.Restored
);
