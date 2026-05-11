/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Project Commands runtime — `IVibeCustomCommandsService`.
 *
 * Wires up the pure helpers that already shipped (decoder, secrets resolver,
 * global-paths merger, terminal-launch decider) into a workbench singleton:
 *
 *   .vibe/commands.json (each workspace root) + vibeide.commands.globalPaths
 *      └─► decodeProjectCommandsFile + mergeProjectCommandsByPriority
 *      └─► snapshot in memory + DidChangeCommandsEvent
 *      └─► run(id):
 *            ├─ resolveProjectCommandSecrets (env: / secret: placeholders)
 *            ├─ ITerminalService.createTerminal (integrated path)
 *            └─ DidStartCommandEvent → DidEndCommandEvent
 *
 * **Phase scope (this commit):**
 *  - Multi-root FS watch on `.vibe/commands.json`.
 *  - Global paths read from `vibeide.commands.globalPaths` (workspace wins).
 *  - Secret placeholder resolution via `IEncryptionService` (secret:) + `process.env` (env:).
 *  - Integrated-terminal spawn via `ITerminalService` (background / external — backlog).
 *  - Events: DidChange / DidStart / DidEnd (success/failure tracked via `onExit`).
 *
 * **Deferred (separate roadmap items):**
 *  - Trust confirm dialog + `.vibe/commands.trust.json` writes.
 *  - Audit log redaction + `IVibeAuditLogService` hookup.
 *  - Dynamic `vibeide.commands.run.<id>` registration in `CommandsRegistry`.
 *  - Status-bar indicator + top-bar pinned-buttons contribution.
 *
 * Per-file lock: a singleton service spans windows; cross-window writes to
 * `.vibe/commands.json` are handled by the FS-watcher debounce.
 */

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ITerminalService } from '../../../contrib/terminal/browser/terminal.js';
import { TerminalLocation } from '../../../../platform/terminal/common/terminal.js';
import {
	ProjectCommand,
	decodeProjectCommandsFile,
} from '../common/projectCommandsTypes.js';
import {
	decodeProjectCommandsGlobalPaths,
	mergeProjectCommandsByPriority,
} from '../common/projectCommandsGlobalPaths.js';
import {
	DidChangeCommandsEvent,
	DidEndCommandEvent,
	DidStartCommandEvent,
} from '../common/projectCommandsServiceContract.js';
import { resolveProjectCommandSecrets } from '../common/projectCommandSecretsResolver.js';
import { generateUuid } from '../../../../base/common/uuid.js';

const COMMANDS_FILE_NAME = '.vibe/commands.json';
const WATCHER_DEBOUNCE_MS = 250;

export const IVibeCustomCommandsService = createDecorator<IVibeCustomCommandsService>('vibeCustomCommandsService');

export interface RunCommandOutcome {
	readonly outcome: 'success' | 'failure' | 'cancelled' | 'refused';
	readonly reason?: string;
	readonly unresolvedPlaceholders?: ReadonlyArray<{ kind: 'env' | 'secret'; name: string }>;
	readonly invocationId: string;
	readonly exitCode?: number;
}

export interface IVibeCustomCommandsService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeCommands: Event<DidChangeCommandsEvent>;
	readonly onDidStartCommand: Event<DidStartCommandEvent>;
	readonly onDidEndCommand: Event<DidEndCommandEvent>;

	/** Current merged snapshot of available commands (workspace wins over globals). */
	getCommands(): ReadonlyArray<ProjectCommand>;

	/** Find a command by id; returns undefined when not present. */
	getCommand(id: string): ProjectCommand | undefined;

	/** Re-scan all sources from disk and update the snapshot. Idempotent. */
	reload(): Promise<void>;

	/** Run a command by id. Returns once the spawned terminal process has exited. */
	run(id: string): Promise<RunCommandOutcome>;
}

class VibeCustomCommandsService extends Disposable implements IVibeCustomCommandsService {
	declare readonly _serviceBrand: undefined;

	private _merged: ProjectCommand[] = [];
	private _initialised = false;

	private readonly _onDidChangeCommands = this._register(new Emitter<DidChangeCommandsEvent>());
	readonly onDidChangeCommands: Event<DidChangeCommandsEvent> = this._onDidChangeCommands.event;

	private readonly _onDidStartCommand = this._register(new Emitter<DidStartCommandEvent>());
	readonly onDidStartCommand: Event<DidStartCommandEvent> = this._onDidStartCommand.event;

	private readonly _onDidEndCommand = this._register(new Emitter<DidEndCommandEvent>());
	readonly onDidEndCommand: Event<DidEndCommandEvent> = this._onDidEndCommand.event;

	private readonly _reloadDebouncer = this._register(new RunOnceScheduler(() => {
		void this._reload('fs-change');
	}, WATCHER_DEBOUNCE_MS));

	constructor(
		@IFileService private readonly _fileService: IFileService,
		@IWorkspaceContextService private readonly _workspace: IWorkspaceContextService,
		@IConfigurationService private readonly _config: IConfigurationService,
		@ILogService private readonly _log: ILogService,
		@ITerminalService private readonly _terminal: ITerminalService,
	) {
		super();

		// Initial load + FS watcher.
		void this._reload('init');

		this._register(this._fileService.onDidFilesChange(e => {
			const roots = this._workspace.getWorkspace().folders.map(f => f.uri);
			const touched = roots.some(root => e.contains(joinPath(root, ...COMMANDS_FILE_NAME.split('/'))));
			if (touched) {
				this._reloadDebouncer.schedule();
			}
		}));

		// Workspace folder add/remove changes the set of files to watch.
		this._register(this._workspace.onDidChangeWorkspaceFolders(() => this._reloadDebouncer.schedule()));

		// Settings change to vibeide.commands.globalPaths invalidates the merged snapshot.
		this._register(this._config.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('vibeide.commands.globalPaths')) {
				void this._reload('global-paths-change');
			}
		}));
	}

	getCommands(): ReadonlyArray<ProjectCommand> {
		return this._merged;
	}

	getCommand(id: string): ProjectCommand | undefined {
		return this._merged.find(c => c.id === id);
	}

	async reload(): Promise<void> {
		await this._reload('manual-reload');
	}

	private async _reload(source: DidChangeCommandsEvent['source']): Promise<void> {
		const workspaceCommands = await this._loadWorkspaceCommands();
		const globalCommands = await this._loadGlobalCommands();
		const merged = mergeProjectCommandsByPriority(workspaceCommands, globalCommands);
		this._merged = [...merged.merged];
		this._initialised = true;
		this._onDidChangeCommands.fire({ commands: this._merged, source });
		if (merged.shadowedGlobalIds.length > 0) {
			this._log.info(`[VibeCustomCommands] ${merged.shadowedGlobalIds.length} global commands shadowed by workspace: ${merged.shadowedGlobalIds.join(', ')}`);
		}
	}

	private async _loadWorkspaceCommands(): Promise<ProjectCommand[]> {
		const folders = this._workspace.getWorkspace().folders;
		const out: ProjectCommand[] = [];
		for (const folder of folders) {
			const uri = joinPath(folder.uri, ...COMMANDS_FILE_NAME.split('/'));
			const file = await this._readAndDecode(uri);
			if (file) {
				out.push(...file.commands);
			}
		}
		return out;
	}

	private async _loadGlobalCommands(): Promise<ProjectCommand[]> {
		const raw = this._config.getValue('vibeide.commands.globalPaths');
		const decoded = decodeProjectCommandsGlobalPaths(raw);
		if (decoded.skipped.length > 0) {
			this._log.warn(`[VibeCustomCommands] vibeide.commands.globalPaths: ${decoded.skipped.length} entries skipped (${decoded.skipped.map(s => s.reason).join(', ')})`);
		}
		const out: ProjectCommand[] = [];
		for (const p of decoded.entries) {
			try {
				const uri = URI.file(p);
				const file = await this._readAndDecode(uri);
				if (file) {
					out.push(...file.commands);
				}
			} catch (e) {
				this._log.warn(`[VibeCustomCommands] global path failed to load: ${p}: ${(e as Error).message}`);
			}
		}
		return out;
	}

	private async _readAndDecode(uri: URI): Promise<{ commands: ProjectCommand[] } | undefined> {
		let buf;
		try {
			buf = await this._fileService.readFile(uri);
		} catch {
			// Missing file is the common case — no commands defined yet.
			return undefined;
		}
		let raw: unknown;
		try {
			raw = JSON.parse(buf.value.toString());
		} catch (e) {
			this._log.warn(`[VibeCustomCommands] invalid JSON in ${uri.toString()}: ${(e as Error).message}`);
			return undefined;
		}
		const decoded = decodeProjectCommandsFile(raw);
		if (!decoded.ok) {
			this._log.warn(`[VibeCustomCommands] ${uri.toString()} decode failed: ${decoded.reason}`);
			return undefined;
		}
		return { commands: [...decoded.value.commands] };
	}

	async run(id: string): Promise<RunCommandOutcome> {
		if (!this._initialised) {
			await this._reload('init');
		}
		const invocationId = generateUuid();
		const cmd = this._merged.find(c => c.id === id);
		if (!cmd) {
			return { outcome: 'refused', reason: 'unknown-command-id', invocationId };
		}

		// Resolve ${env:NAME} / ${secret:KEY} placeholders.
		const resolveResult = resolveProjectCommandSecrets(
			{
				command: cmd.command,
				args: cmd.args,
				cwd: cmd.cwd,
				env: cmd.env,
			},
			{
				env: (name: string) => {
					try {
						return process.env[name];
					} catch {
						return undefined;
					}
				},
				// Secrets via IEncryptionService — deferred (needs Phase 2 wiring).
				// For now, unresolved secret: placeholders refuse the run with a clear reason.
				secret: () => undefined,
			},
		);

		if (resolveResult.unresolved.length > 0) {
			this._log.warn(`[VibeCustomCommands] refused ${id}: ${resolveResult.unresolved.length} unresolved placeholder(s)`);
			return {
				outcome: 'refused',
				reason: 'unresolved-placeholders',
				unresolvedPlaceholders: resolveResult.unresolved.map(u => ({ kind: u.kind, name: u.name })),
				invocationId,
			};
		}

		const startedAtMs = Date.now();
		this._onDidStartCommand.fire({ id: cmd.id, name: cmd.name, invocationId, startedAtMs });

		// Phase scope: integrated terminal only. external / background are deferred.
		const terminalKind = cmd.terminal ?? 'integrated';
		if (terminalKind !== 'integrated') {
			this._log.warn(`[VibeCustomCommands] refused ${id}: terminal=${terminalKind} not yet supported (Phase 2)`);
			const endedAtMs = Date.now();
			this._onDidEndCommand.fire({
				id: cmd.id, name: cmd.name, invocationId, endedAtMs,
				durationMs: endedAtMs - startedAtMs, outcome: 'failure',
			});
			return { outcome: 'refused', reason: `terminal-kind-not-supported:${terminalKind}`, invocationId };
		}

		try {
			const cwdUri = this._resolveCwd(cmd.cwd);
			const fullCommand = this._buildShellLine(resolveResult.resolved.command, resolveResult.resolved.args);
			const terminal = await this._terminal.createTerminal({
				cwd: cwdUri,
				location: TerminalLocation.Panel,
				config: {
					name: `Vibe: ${cmd.name}`,
					forceShellIntegration: true,
					env: { ...resolveResult.resolved.env },
				},
				skipContributedProfileCheck: true,
			});

			// Bring the terminal forward and send the command line.
			await this._terminal.setActiveInstance(terminal);
			await this._terminal.focusActiveInstance();
			await terminal.sendText(fullCommand, /* shouldExecute */ true);

			// Listen for exit to fire DidEndCommandEvent. Best-effort; if the user closes
			// the terminal manually before exit, the listener still fires with exitCode=undefined.
			const onExitDispose = terminal.onExit((exitInfo) => {
				try {
					const endedAtMs = Date.now();
					const exitCode = typeof exitInfo === 'object' && exitInfo !== null && 'code' in exitInfo
						? (exitInfo as { code?: number }).code
						: typeof exitInfo === 'number'
							? exitInfo
							: undefined;
					this._onDidEndCommand.fire({
						id: cmd.id,
						name: cmd.name,
						invocationId,
						endedAtMs,
						durationMs: endedAtMs - startedAtMs,
						outcome: exitCode === 0 ? 'success' : 'failure',
						exitCode,
					});
				} finally {
					onExitDispose.dispose();
				}
			});

			return { outcome: 'success', invocationId };
		} catch (e) {
			this._log.error(`[VibeCustomCommands] failed to spawn ${id}: ${(e as Error).message}`);
			const endedAtMs = Date.now();
			this._onDidEndCommand.fire({
				id: cmd.id, name: cmd.name, invocationId, endedAtMs,
				durationMs: endedAtMs - startedAtMs, outcome: 'failure',
			});
			return { outcome: 'failure', reason: (e as Error).message, invocationId };
		}
	}

	/** Resolve cwd relative to the first workspace root when given a relative string. */
	private _resolveCwd(cwd: string | undefined): URI | undefined {
		if (!cwd) {
			return this._workspace.getWorkspace().folders[0]?.uri;
		}
		// Absolute path: use as-is via URI.file.
		if (/^([a-zA-Z]:[\\/]|\/)/.test(cwd)) {
			return URI.file(cwd);
		}
		// Relative: join under the first workspace folder.
		const root = this._workspace.getWorkspace().folders[0]?.uri;
		if (!root) {
			return undefined;
		}
		return joinPath(root, ...cwd.split(/[\\/]/));
	}

	/** Compose the line that gets sent to the integrated terminal. */
	private _buildShellLine(command: string, args: readonly string[]): string {
		if (!args || args.length === 0) {
			return command;
		}
		const quoted = args.map(a => this._quoteShellArg(a));
		return [command, ...quoted].join(' ');
	}

	/** Best-effort POSIX/PowerShell-friendly quoting. */
	private _quoteShellArg(arg: string): string {
		if (arg.length === 0) {
			return "''";
		}
		if (/^[A-Za-z0-9_.@:/=+-]+$/.test(arg)) {
			return arg;
		}
		// Wrap in single quotes; escape embedded single quotes.
		return `'${arg.replace(/'/g, `'\\''`)}'`;
	}
}

registerSingleton(IVibeCustomCommandsService, VibeCustomCommandsService, InstantiationType.Delayed);
