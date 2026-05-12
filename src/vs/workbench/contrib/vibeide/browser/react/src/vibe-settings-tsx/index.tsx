/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { Settings } from './Settings.js'
import { VibeProjectCommandForm } from './VibeProjectCommandForm.js'

export const mountVibeSettings = mountFnGenerator(Settings)
export const mountVibeProjectCommandForm = mountFnGenerator(VibeProjectCommandForm)


