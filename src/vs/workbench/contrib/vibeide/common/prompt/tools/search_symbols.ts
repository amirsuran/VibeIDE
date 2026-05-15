/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ToolDef } from './_helpers.js';

export const SEARCH_SYMBOLS_TOOL: ToolDef<'search_symbols'> = {
	name: 'search_symbols',
	description: `Searches for symbols (functions, classes, variables) by name. Can search in a specific file or across the workspace.`,
	params: {
		query: { description: 'The symbol name or pattern to search for.' },
		uri: { description: 'Optional. The file URI to search in. If not provided, searches the entire workspace.' },
	},
};
