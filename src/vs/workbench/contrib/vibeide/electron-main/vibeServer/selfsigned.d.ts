/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 VibeIDE Team. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Minimal ambient types for the `selfsigned` package (no @types published).
declare module 'selfsigned' {
	export interface SelfsignedAttribute {
		readonly name: string;
		readonly value?: string;
	}
	export interface SelfsignedAltName {
		readonly type: number;
		readonly value?: string;
		readonly ip?: string;
	}
	export interface SelfsignedExtension {
		readonly name: string;
		readonly altNames?: readonly SelfsignedAltName[];
		readonly [key: string]: unknown;
	}
	export interface SelfsignedOptions {
		readonly days?: number;
		readonly keySize?: number;
		readonly algorithm?: string;
		readonly extensions?: readonly SelfsignedExtension[];
	}
	export interface SelfsignedResult {
		readonly private: string;
		readonly public: string;
		readonly cert: string;
	}
	export function generate(attrs?: readonly SelfsignedAttribute[], options?: SelfsignedOptions): SelfsignedResult;
}
