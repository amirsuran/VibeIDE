/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * VibeDesktopNotificationService — OS-level notifications for blocking agent approvals.
 *
 * When the agent pauses and waits for user approval (tool approval, pre-flight,
 * dead man's switch, plan step consent) and the IDE window is in the background,
 * this service fires an OS desktop notification so the user doesn't miss it.
 *
 * Features:
 *  - Uses Electron shell.showItemInFolder / notification API (Phase MVP: INotificationService fallback)
 *  - Throttled: max 1 notification per 30 s per approval type (no spam)
 *  - Configurable: users can disable or restrict which event types trigger notifications
 *  - Trust Score / DMS integration: high-risk approvals fire immediately without throttle bypass
 *  - Privacy: notification body never contains file contents or API keys
 *
 * Phase MVP: INotificationService (in-IDE) + rate limiter.
 * Phase 3b: Electron Notification API for true OS-level toast.
 */

import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { localize } from '../../../../nls.js';
import { validateDesktopNotification } from '../common/desktopNotificationSpec.js';

// ── Configuration ─────────────────────────────────────────────────────────────

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'vibeide',
	properties: {
		'vibeide.notifications.desktopApprovals.enabled': {
			type: 'boolean',
			default: true,
			description: localize('vibeide.notifications.desktopApprovals.enabled', 'Показывать desktop-уведомления ОС, когда агент ждёт вашего подтверждения.'),
		},
		'vibeide.notifications.desktopApprovals.throttleMs': {
			type: 'number',
			default: 30000,
			minimum: 5000,
			maximum: 300000,
			description: localize('vibeide.notifications.desktopApprovals.throttleMs', 'Минимум миллисекунд между desktop-уведомлениями одного типа. Защищает от спама.'),
		},
		'vibeide.notifications.desktopApprovals.events': {
			type: 'array',
			items: { type: 'string', enum: ['tool_approval', 'pre_flight', 'dead_mans_switch', 'plan_consent', 'trust_score_critical'] },
			default: ['tool_approval', 'pre_flight', 'dead_mans_switch', 'trust_score_critical'],
			description: localize('vibeide.notifications.desktopApprovals.events', 'Какие события агента вызывают desktop-уведомление.'),
		},
	},
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApprovalEventType = 'tool_approval' | 'pre_flight' | 'dead_mans_switch' | 'plan_consent' | 'trust_score_critical';

export interface DesktopApprovalNotification {
	type: ApprovalEventType;
	title: string;
	body: string;
	/** If true, throttle is bypassed (for critical events) */
	urgent?: boolean;
}

export const IVibeDesktopNotificationService = createDecorator<IVibeDesktopNotificationService>('vibeDesktopNotificationService');

export interface IVibeDesktopNotificationService {
	readonly _serviceBrand: undefined;

	/** Notify user that the agent is waiting for an approval. Respects throttle and enable setting. */
	notifyApprovalNeeded(notification: DesktopApprovalNotification): void;

	/** Dismiss any pending notification for a given event type (e.g. after user approves). */
	dismissForType(type: ApprovalEventType): void;
}

// ── Implementation ─────────────────────────────────────────────────────────────

class VibeDesktopNotificationService extends Disposable implements IVibeDesktopNotificationService {
	declare readonly _serviceBrand: undefined;

	private readonly _lastFiredAt = new Map<ApprovalEventType, number>();
	/** Live OS notifications keyed by type so we can programmatically close them */
	private readonly _activeOsNotifications = new Map<ApprovalEventType, Notification>();

	constructor(
		@ILogService private readonly _log: ILogService,
		@IConfigurationService private readonly _config: IConfigurationService,
		@INotificationService private readonly _notifications: INotificationService,
	) {
		super();
	}

	notifyApprovalNeeded(notification: DesktopApprovalNotification): void {
		if (!this._config.getValue<boolean>('vibeide.notifications.desktopApprovals.enabled')) {
			return;
		}

		const enabledEvents = this._config.getValue<ApprovalEventType[]>('vibeide.notifications.desktopApprovals.events') ?? [];
		if (!enabledEvents.includes(notification.type)) {
			return;
		}

		const throttleMs = this._config.getValue<number>('vibeide.notifications.desktopApprovals.throttleMs') ?? 30000;
		const lastFired = this._lastFiredAt.get(notification.type) ?? 0;
		const now = Date.now();

		if (!notification.urgent && now - lastFired < throttleMs) {
			this._log.trace(`[VibeDesktopNotif] Throttled ${notification.type} (${now - lastFired}ms since last)`);
			return;
		}

		this._lastFiredAt.set(notification.type, now);
		this._log.info(`[VibeDesktopNotif] Firing approval notification: type=${notification.type} urgent=${notification.urgent}`);

		const draft = { title: notification.title, body: notification.body, urgency: notification.urgent ? 'critical' as const : 'normal' as const };
		const validation = validateDesktopNotification(draft, this._getPlatform());
		if (!validation.ok) {
			this._log.warn(`[VibeDesktopNotif] Spec validation failed: ${validation.issues.join(', ')} — falling back to in-IDE toast`);
			this._notifications.notify({ severity: Severity.Info, message: `${notification.title}\n${notification.body}` });
			return;
		}

		// Use Electron's window.Notification when available and the window is not focused.
		// Fallback to INotificationService (in-IDE toast) when the window is in front or
		// the Notification API is absent (web context).
		const windowFocused = typeof document !== 'undefined' && document.hasFocus();
		const canUseOs = typeof window !== 'undefined'
			&& typeof (window as any).Notification === 'function'
			&& (window as any).Notification.permission === 'granted';

		if (canUseOs && !windowFocused) {
			try {
				const prev = this._activeOsNotifications.get(notification.type);
				prev?.close();
				const osn = new (window as any).Notification(validation.spec.title, { body: validation.spec.body, silent: validation.spec.silent });
				this._activeOsNotifications.set(notification.type, osn);
				this._log.trace(`[VibeDesktopNotif] OS notification fired for type=${notification.type}`);
			} catch (err) {
				this._log.warn(`[VibeDesktopNotif] OS Notification threw: ${err} — falling back to in-IDE toast`);
				this._notifications.notify({ severity: notification.urgent ? Severity.Warning : Severity.Info, message: `${notification.title}\n${notification.body}` });
			}
		} else {
			this._notifications.notify({
				severity: notification.urgent ? Severity.Warning : Severity.Info,
				message: `${notification.title}\n${notification.body}`,
			});
		}
	}

	dismissForType(type: ApprovalEventType): void {
		const osn = this._activeOsNotifications.get(type);
		if (osn) {
			try { osn.close(); } catch { /* already closed */ }
			this._activeOsNotifications.delete(type);
		}
		this._log.trace(`[VibeDesktopNotif] Dismissed type=${type}`);
	}

	private _getPlatform(): import('../common/desktopNotificationSpec.js').NotificationPlatform {
		if (typeof process !== 'undefined' && typeof process.platform === 'string') {
			const p = process.platform;
			if (p === 'win32' || p === 'darwin' || p === 'linux') return p;
		}
		return 'unknown';
	}
}

registerSingleton(IVibeDesktopNotificationService, VibeDesktopNotificationService, InstantiationType.Delayed);
