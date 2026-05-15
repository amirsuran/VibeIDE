/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ToolDef } from './_helpers.js';

export const WEB_SEARCH_TOOL: ToolDef<'web_search'> = {
	name: 'web_search',
	description: `Searches the web for information. Returns top search results with titles, snippets, and URLs. Use this when the user asks you to search the web, look something up online, or when you need current information beyond your training data.`,
	params: {
		query: { description: 'The search query string.' },
		k: { description: 'Optional. Number of results to return (default is 5). Maximum is 10.' },
		refresh: { description: 'Optional. If true, bypasses cache and fetches fresh results. Default is false.' },
	},
};
