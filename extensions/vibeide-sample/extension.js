// VibeIDE sample extension — calls one accessor from each VibeIDE proposed namespace
// and surfaces a notification with the result. Acceptance proof for the
// `vibeideReadonly` proposal in references/v1/extension-api-readonly-draft.md.
//
// Until the proposed typings land in src/vscode-dts/, we cast through `any` to call
// the VibeIDE namespace. When the typings exist, the cast disappears and the file
// becomes a five-line tutorial (see docs/v1/extension-development.md).

'use strict';

const vscode = require('vscode');

/** @param {import('vscode').ExtensionContext} context */
function activate(context) {
	const showCommand = vscode.commands.registerCommand('vibeideSample.show', async () => {
		const vibeide = /** @type {any} */ (vscode).vibeide;
		if (!vibeide) {
			await vscode.window.showWarningMessage(
				'VibeIDE proposed API not present. Run inside VibeIDE 0.3.0 or later, ' +
				'and add "vibeideReadonly" to enabledApiProposals in your manifest.'
			);
			return;
		}

		try {
			const status = await vibeide.agent.status();
			const skills = await vibeide.skills.list();
			const folder = vscode.workspace.workspaceFolders?.[0];
			const target = folder ? folder.uri.fsPath : '';
			const allowed = target
				? await vibeide.constraints.queryAllowed({ tool: 'edit_file', target })
				: null;

			const lines = [
				`Mode: ${status.mode}`,
				`Running: ${status.running}`,
				`Skills: ${skills.length}`,
				`Edit allowed at workspace root: ${allowed === null ? 'no workspace' : allowed ? 'yes' : 'no'}`,
			];
			await vscode.window.showInformationMessage(lines.join(' · '));
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await vscode.window.showErrorMessage('VibeIDE sample: ' + message);
		}
	});

	const planSub = (() => {
		const vibeide = /** @type {any} */ (vscode).vibeide;
		if (!vibeide || !vibeide.plans) {
			return { dispose() { } };
		}
		try {
			return vibeide.plans.subscribeToEvents((evt) => {
				console.log('[vibeide-sample] plan event:', evt.type, evt.planId);
			});
		} catch {
			return { dispose() { } };
		}
	})();

	context.subscriptions.push(showCommand, planSub);
}

function deactivate() { /* no-op */ }

module.exports = { activate, deactivate };
