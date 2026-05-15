/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ToolDef, uriParam } from './_helpers.js';

export const READ_LINT_ERRORS_TOOL: ToolDef<'read_lint_errors'> = {
	name: 'read_lint_errors',
	description: `Use this tool to view all the lint errors on a file.`,
	params: {
		...uriParam('file'),
	},
};
