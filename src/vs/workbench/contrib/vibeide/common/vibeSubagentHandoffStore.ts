/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import type { SubagentType } from './vibeSubagentService.js';

/**
 * Durable record of a subagent that STOPPED with partial work (token/step/deadline limit).
 * Persisted so the work is not lost across a route halt or an IDE restart: it can be resumed
 * automatically (up to `vibeide.subagent.maxResumes`) or, once auto-resumes are exhausted,
 * manually by the user / parent agent. See the durable-handoff workstream.
 */
export interface SubagentHandoffTicket {
	readonly id: string;
	readonly createdAt: number;
	readonly updatedAt: number;
	/** open = awaiting pickup; resumed = a continuation is running; done = finished; abandoned = dropped. */
	readonly status: 'open' | 'resumed' | 'done' | 'abandoned';
	readonly parentThreadId: string;
	readonly role: SubagentType;
	/** The original task text — enough to rebuild the role goal on resume (survives restart). */
	readonly taskText: string;
	/** Partial result accumulated so far (last output); grows across resumes. */
	readonly partialSummary: string;
	readonly artifacts: readonly string[];
	readonly stopReason: string;
	readonly tokensUsed: number;
	/** How many times this ticket was already resumed (auto or manual) — the loop guard. */
	readonly resumeCount: number;
}

const STORAGE_KEY = 'vibeide.subagent.handoffs';

export const IVibeSubagentHandoffStore = createDecorator<IVibeSubagentHandoffStore>('vibeSubagentHandoffStore');

export interface IVibeSubagentHandoffStore {
	readonly _serviceBrand: undefined;
	/** Fired whenever the ticket set changes (create/update/remove) — drives the «субпин» indicator. */
	readonly onDidChange: Event<void>;
	/** Create a new open ticket from a stopped subagent's partial work. Returns the ticket. */
	create(input: Omit<SubagentHandoffTicket, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'resumeCount'>): SubagentHandoffTicket;
	/** Patch an existing ticket (partial fields); no-op if the id is gone. */
	update(id: string, patch: Partial<Omit<SubagentHandoffTicket, 'id' | 'createdAt'>>): void;
	get(id: string): SubagentHandoffTicket | undefined;
	list(): readonly SubagentHandoffTicket[];
	/** Only tickets still awaiting a human decision (status 'open'). */
	listOpen(): readonly SubagentHandoffTicket[];
	remove(id: string): void;
}

class VibeSubagentHandoffStore extends Disposable implements IVibeSubagentHandoffStore {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IStorageService private readonly _storage: IStorageService,
	) {
		super();
	}

	private _read(): SubagentHandoffTicket[] {
		const raw = this._storage.get(STORAGE_KEY, StorageScope.WORKSPACE, '[]');
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed as SubagentHandoffTicket[] : [];
		} catch {
			return [];
		}
	}

	private _write(tickets: SubagentHandoffTicket[]): void {
		this._storage.store(STORAGE_KEY, JSON.stringify(tickets), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		this._onDidChange.fire();
	}

	create(input: Omit<SubagentHandoffTicket, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'resumeCount'>): SubagentHandoffTicket {
		const now = Date.now();
		const ticket: SubagentHandoffTicket = { ...input, id: generateUuid(), createdAt: now, updatedAt: now, status: 'open', resumeCount: 0 };
		this._write([...this._read(), ticket]);
		return ticket;
	}

	update(id: string, patch: Partial<Omit<SubagentHandoffTicket, 'id' | 'createdAt'>>): void {
		const tickets = this._read();
		const idx = tickets.findIndex(t => t.id === id);
		if (idx === -1) { return; }
		tickets[idx] = { ...tickets[idx], ...patch, updatedAt: Date.now() };
		this._write(tickets);
	}

	get(id: string): SubagentHandoffTicket | undefined {
		return this._read().find(t => t.id === id);
	}

	list(): readonly SubagentHandoffTicket[] {
		return this._read();
	}

	listOpen(): readonly SubagentHandoffTicket[] {
		return this._read().filter(t => t.status === 'open');
	}

	remove(id: string): void {
		const tickets = this._read();
		const next = tickets.filter(t => t.id !== id);
		if (next.length !== tickets.length) { this._write(next); }
	}
}

registerSingleton(IVibeSubagentHandoffStore, VibeSubagentHandoffStore, InstantiationType.Delayed);

/**
 * Build the goal for a continuation subagent: the original task plus a compact «already done»
 * preamble so the resumed role continues instead of starting over. Pure — unit-tested.
 */
export function buildResumeGoal(taskText: string, role: string, partialSummary: string): string {
	const base = `Роль: ${role}. Задача: ${taskText}`;
	const done = partialSummary.trim();
	if (!done) { return base; }
	return `${base}\n\nУже сделано ранее (продолжи с этого места, НЕ начинай заново):\n${done}`;
}
