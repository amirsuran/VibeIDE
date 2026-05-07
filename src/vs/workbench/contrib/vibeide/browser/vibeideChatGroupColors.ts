/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerColor } from '../../../../platform/theme/common/colorRegistry.js';
import { localize } from '../../../../nls.js';

// Registers theme-aware color tokens for the VibeIDE chat editor group marker.
// VS Code exposes each token as --vscode-<id-with-dots-as-dashes> CSS custom property,
// so vibe-neon.css can reference them without hardcoding hex values.

export const VIBEIDE_CHAT_GROUP_ACTIVE_BORDER = registerColor(
	'vibeide.chatGroup.activeBorder',
	{ dark: '#fc28a8', light: '#9900cc', hcDark: '#ffffff', hcLight: '#000000' },
	localize('vibeide.chatGroup.activeBorder', 'Border color marking the VibeIDE chat editor group.')
);

export const VIBEIDE_CHAT_GROUP_TABS_BACKGROUND = registerColor(
	'vibeide.chatGroup.tabsBackground',
	{ dark: '#1d0e30', light: '#f5eeff', hcDark: null, hcLight: null },
	localize('vibeide.chatGroup.tabsBackground', 'Tab header background of the VibeIDE chat editor group.')
);

export const VIBEIDE_CHAT_GROUP_GLOW_COLOR = registerColor(
	'vibeide.chatGroup.glowColor',
	{ dark: '#fc28a833', light: '#9900cc22', hcDark: null, hcLight: null },
	localize('vibeide.chatGroup.glowColor', 'Neon glow color of the VibeIDE chat editor group border (neon themes only).')
);
