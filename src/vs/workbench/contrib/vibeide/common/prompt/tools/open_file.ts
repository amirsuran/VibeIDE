/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ToolDef, uriParam } from './_helpers.js';

export const OPEN_FILE_TOOL: ToolDef<'open_file'> = {
	name: 'open_file',
	description: `Opens a file in the editor. Use this when the user asks to "open" a file.`,
	params: {
		...uriParam('file'),
	},
};
