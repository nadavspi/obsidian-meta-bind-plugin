import { type IPlugin } from 'packages/core/src/IPlugin';
import { SyntaxHighlightingAPI } from 'packages/core/src/api/SyntaxHighlightingAPI';
import {
	type ButtonGroupOptions,
	type ButtonOptions,
	type EmbedOptions,
	type FieldOptionMap,
	FieldType,
	type InlineFieldType,
	type InputFieldOptions,
	isFieldTypeAllowedInline,
	type JsViewFieldOptions,
	type NotePosition,
	RenderChildType,
	type ViewFieldOptions,
} from 'packages/core/src/config/FieldConfigs';
import { type FieldBase } from 'packages/core/src/fields/FieldBase';
import { ButtonActionRunner } from 'packages/core/src/fields/button/ButtonActionRunner';
import { ButtonBase } from 'packages/core/src/fields/button/ButtonBase';
import { ButtonManager } from 'packages/core/src/fields/button/ButtonManager';
import { ButtonGroupBase } from 'packages/core/src/fields/button/ButtonGroupBase';
import { InputFieldBase } from 'packages/core/src/fields/inputFields/InputFieldBase';
import { InputFieldFactory } from 'packages/core/src/fields/inputFields/InputFieldFactory';
import { JsViewField } from 'packages/core/src/fields/viewFields/JsViewField';
import { ViewFieldBase } from 'packages/core/src/fields/viewFields/ViewFieldBase';
import { ViewFieldFactory } from 'packages/core/src/fields/viewFields/ViewFieldFactory';
import type { BindTargetScope } from 'packages/core/src/metadata/BindTargetScope';
import { BindTargetParser } from 'packages/core/src/parsers/bindTargetParser/BindTargetParser';
import { InputFieldParser } from 'packages/core/src/parsers/inputFieldParser/InputFieldParser';
import { ViewFieldParser } from 'packages/core/src/parsers/viewFieldParser/ViewFieldParser';
import { expectType, getUUID } from 'packages/core/src/utils/Utils';
import { ErrorLevel, MetaBindInternalError } from 'packages/core/src/utils/errors/MetaBindErrors';
import { EmbedBase } from 'packages/core/src/fields/embed/EmbedBase';
import { ExcludedBase } from 'packages/core/src/fields/excluded/ExcludedBase';
import { type InputFieldDeclaration } from 'packages/core/src/parsers/inputFieldParser/InputFieldDeclaration';
import {
	type JsViewFieldDeclaration,
	type ViewFieldDeclaration,
} from 'packages/core/src/parsers/viewFieldParser/ViewFieldDeclaration';
import {
	type ButtonDeclaration,
	type ButtonGroupDeclaration,
	ButtonParser,
} from 'packages/core/src/parsers/ButtonParser';
import { JsViewFieldParser } from 'packages/core/src/parsers/viewFieldParser/JsViewFieldParser';
import { Signal } from 'packages/core/src/utils/Signal';
import { parsePropPath } from 'packages/core/src/utils/prop/PropParser';
import { type BindTargetDeclaration } from 'packages/core/src/parsers/bindTargetParser/BindTargetDeclaration';
import { type MetadataSubscription } from 'packages/core/src/metadata/MetadataSubscription';
import {
	V_BindTargetDeclaration,
	V_BindTargetScope,
	V_ButtonOptions,
	V_EmbedOptions,
	V_FieldType,
	V_FilePath,
	V_InlineButtonOptions,
	V_InputFieldOptions,
	V_JsViewFieldOptions,
	V_RenderChildType,
	V_ViewFieldOptions,
} from 'packages/core/src/api/Validators';
import { validate } from 'packages/core/src/utils/ZodUtils';
import { z } from 'zod';

export interface APIFieldOverrides {
	inputFieldParser?: InputFieldParser;
	viewFieldParser?: ViewFieldParser;
	jsViewFieldParser?: JsViewFieldParser;
	buttonParser?: ButtonParser;
	bindTargetParser?: BindTargetParser;
	inputFieldFactory?: InputFieldFactory;
	viewFieldFactory?: ViewFieldFactory;
	buttonActionRunner?: ButtonActionRunner;
	buttonManager?: ButtonManager;
	syntaxHighlighting?: SyntaxHighlightingAPI;
}

export abstract class API<Plugin extends IPlugin> {
	readonly plugin: Plugin;

	readonly inputFieldParser: InputFieldParser;
	readonly viewFieldParser: ViewFieldParser;
	readonly jsViewFieldParser: JsViewFieldParser;
	readonly buttonParser: ButtonParser;
	readonly bindTargetParser: BindTargetParser;

	readonly inputFieldFactory: InputFieldFactory;
	readonly viewFieldFactory: ViewFieldFactory;

	readonly buttonActionRunner: ButtonActionRunner;
	readonly buttonManager: ButtonManager;

	readonly syntaxHighlighting: SyntaxHighlightingAPI;

	constructor(plugin: Plugin, overrides?: APIFieldOverrides) {
		this.plugin = plugin;

		this.inputFieldParser = overrides?.inputFieldParser ?? new InputFieldParser(plugin);
		this.viewFieldParser = overrides?.viewFieldParser ?? new ViewFieldParser(plugin);
		this.jsViewFieldParser = overrides?.jsViewFieldParser ?? new JsViewFieldParser(plugin);
		this.buttonParser = overrides?.buttonParser ?? new ButtonParser(plugin);
		this.bindTargetParser = overrides?.bindTargetParser ?? new BindTargetParser(plugin);

		this.inputFieldFactory = overrides?.inputFieldFactory ?? new InputFieldFactory(plugin);
		this.viewFieldFactory = overrides?.viewFieldFactory ?? new ViewFieldFactory(plugin);

		this.buttonActionRunner = overrides?.buttonActionRunner ?? new ButtonActionRunner(plugin);
		this.buttonManager = overrides?.buttonManager ?? new ButtonManager(plugin);

		this.syntaxHighlighting = overrides?.syntaxHighlighting ?? new SyntaxHighlightingAPI(plugin);
	}

	/**
	 * Creates a field of a given type.
	 *
	 * @param type
	 * @param filePath
	 * @param options
	 * @param honorExcludedSetting
	 */
	public createField<Type extends FieldType>(
		type: Type,
		filePath: string,
		options: FieldOptionMap[Type],
		honorExcludedSetting: boolean = true,
	): FieldBase {
		validate(
			z.object({
				type: V_FieldType,
				filePath: V_FilePath,
				options: z.any(),
				honorExcludedSetting: z.boolean(),
			}),
			{
				type: type,
				filePath: filePath,
				options: options,
				honorExcludedSetting: honorExcludedSetting,
			},
		);

		if (this.plugin.internal.isFilePathExcluded(filePath) && honorExcludedSetting) {
			return this.createExcludedBase(filePath);
		}

		if (type === FieldType.INPUT_FIELD) {
			return this.createInputFieldBase(filePath, options as FieldOptionMap[FieldType.INPUT_FIELD]);
		} else if (type === FieldType.VIEW_FIELD) {
			return this.createViewFieldBase(filePath, options as FieldOptionMap[FieldType.VIEW_FIELD]);
		} else if (type === FieldType.JS_VIEW_FIELD) {
			return this.createJsViewFieldBase(filePath, options as FieldOptionMap[FieldType.JS_VIEW_FIELD]);
		} else if (type === FieldType.BUTTON_GROUP) {
			return this.createButtonGroupBase(filePath, options as FieldOptionMap[FieldType.BUTTON_GROUP]);
		} else if (type === FieldType.BUTTON) {
			return this.createButtonBase(filePath, options as FieldOptionMap[FieldType.BUTTON]);
		} else if (type === FieldType.EMBED) {
			return this.createEmbedBase(filePath, options as FieldOptionMap[FieldType.EMBED]);
		} else if (type === FieldType.EXCLUDED) {
			return this.createExcludedBase(filePath);
		}

		expectType<never>(type);

		// TODO: Nice error message
		throw new Error(`Unknown field type: ${type}`);
	}

	/**
	 * Creates an inline field from a string.
	 * Will throw an error if the string is not a valid declaration.
	 *
	 * @param fieldString
	 * @param filePath
	 * @param scope
	 * @param renderChildType
	 * @param position
	 * @param honorExcludedSetting
	 */
	public createInlineFieldFromString(
		fieldString: string,
		filePath: string,
		scope: BindTargetScope | undefined,
		renderChildType: RenderChildType = RenderChildType.INLINE,
		position?: NotePosition | undefined,
		honorExcludedSetting: boolean = true,
	): FieldBase {
		validate(
			z.object({
				fieldString: z.string(),
				filePath: V_FilePath,
				scope: V_BindTargetScope.optional(),
				renderChildType: V_RenderChildType,
				honorExcludedSetting: z.boolean(),
			}),
			{
				fieldString: fieldString,
				filePath: filePath,
				scope: scope,
				renderChildType: renderChildType,
				honorExcludedSetting: honorExcludedSetting,
			},
		);

		const fieldType = this.isInlineFieldDeclarationAndGetType(fieldString);
		if (fieldType === undefined) {
			throw new MetaBindInternalError({
				errorLevel: ErrorLevel.CRITICAL,
				effect: 'failed to create inline field',
				cause: `Invalid inline mdrc type "${fieldType}"`,
			});
		}

		return this.createInlineFieldOfTypeFromString(
			fieldType,
			fieldString,
			filePath,
			scope,
			renderChildType,
			position,
			honorExcludedSetting,
		);
	}

	/**
	 * Creates an inline field of a given type and string.
	 * Will throw an error if the string is not a valid inline field type.
	 *
	 * @param type
	 * @param filePath
	 * @param declaration
	 * @param scope
	 * @param renderChildType
	 * @param position
	 * @param honorExcludedSetting
	 */
	public createInlineFieldOfTypeFromString(
		type: InlineFieldType,
		declaration: string,
		filePath: string,
		scope: BindTargetScope | undefined,
		renderChildType: RenderChildType = RenderChildType.INLINE,
		position?: NotePosition | undefined,
		honorExcludedSetting: boolean = true,
	): FieldBase {
		validate(
			z.object({
				type: V_FieldType,
				declaration: z.string(),
				filePath: V_FilePath,
				scope: V_BindTargetScope.optional(),
				renderChildType: V_RenderChildType,
				honorExcludedSetting: z.boolean(),
			}),
			{
				type: type,
				declaration: declaration,
				filePath: filePath,
				scope: scope,
				renderChildType: renderChildType,
				honorExcludedSetting: honorExcludedSetting,
			},
		);

		if (this.plugin.internal.isFilePathExcluded(filePath) && honorExcludedSetting) {
			return this.createExcludedBase(filePath);
		}

		if (type === FieldType.INPUT_FIELD) {
			return this.createInputFieldBase(filePath, {
				renderChildType: renderChildType,
				declaration: declaration,
				scope: scope,
			});
		}

		if (type === FieldType.VIEW_FIELD) {
			return this.createViewFieldBase(filePath, {
				renderChildType: renderChildType,
				declaration: declaration,
				scope: scope,
			});
		}

		if (type === FieldType.BUTTON_GROUP) {
			return this.createButtonGroupBase(filePath, {
				renderChildType: renderChildType,
				declaration: declaration,
				position: position,
			});
		}

		expectType<never>(type);

		throw new MetaBindInternalError({
			errorLevel: ErrorLevel.CRITICAL,
			effect: 'failed to create inline field',
			cause: `Invalid inline mdrc type "${type}"`,
		});
	}

	public createInputFieldBase(filePath: string, options: InputFieldOptions): InputFieldBase {
		validate(
			z.object({
				filePath: V_FilePath,
				options: V_InputFieldOptions,
			}),
			{
				filePath: filePath,
				options: options,
			},
		);

		const uuid = getUUID();

		let declaration: InputFieldDeclaration;
		if (typeof options.declaration === 'string') {
			declaration = this.inputFieldParser.fromStringAndValidate(options.declaration, filePath, options.scope);
		} else {
			declaration = this.inputFieldParser.fromSimpleDeclarationAndValidate(
				options.declaration,
				filePath,
				options.scope,
			);
		}

		return new InputFieldBase(this.plugin, uuid, filePath, options.renderChildType, declaration);
	}

	public createViewFieldBase(filePath: string, options: ViewFieldOptions): ViewFieldBase {
		validate(
			z.object({
				filePath: V_FilePath,
				options: V_ViewFieldOptions,
			}),
			{
				filePath: filePath,
				options: options,
			},
		);

		const uuid = getUUID();

		let declaration: ViewFieldDeclaration;
		if (typeof options.declaration === 'string') {
			declaration = this.viewFieldParser.fromStringAndValidate(options.declaration, filePath, options.scope);
		} else {
			declaration = this.viewFieldParser.fromSimpleDeclarationAndValidate(
				options.declaration,
				filePath,
				options.scope,
			);
		}

		return new ViewFieldBase(this.plugin, uuid, filePath, options.renderChildType, declaration);
	}

	public createJsViewFieldBase(filePath: string, options: JsViewFieldOptions): JsViewField {
		validate(
			z.object({
				filePath: V_FilePath,
				options: V_JsViewFieldOptions,
			}),
			{
				filePath: filePath,
				options: options,
			},
		);

		const uuid = getUUID();

		let declaration: JsViewFieldDeclaration;
		if (typeof options.declaration === 'string') {
			declaration = this.jsViewFieldParser.fromStringAndValidate(options.declaration, filePath);
		} else {
			declaration = this.jsViewFieldParser.fromSimpleDeclarationAndValidate(options.declaration, filePath);
		}

		return new JsViewField(this.plugin, uuid, filePath, declaration);
	}

	public createButtonGroupBase(filePath: string, options: ButtonGroupOptions): ButtonGroupBase {
		validate(
			z.object({
				filePath: V_FilePath,
				options: V_InlineButtonOptions,
			}),
			{
				filePath: filePath,
				options: options,
			},
		);

		const uuid = getUUID();

		let declaration: ButtonGroupDeclaration;
		if (typeof options.declaration === 'string') {
			declaration = this.buttonParser.fromGroupString(options.declaration);
		} else {
			declaration = this.buttonParser.validateGroup(options.declaration);
		}

		return new ButtonGroupBase(this.plugin, uuid, filePath, declaration, options.renderChildType, options.position);
	}

	public createButtonBase(filePath: string, options: ButtonOptions): ButtonBase {
		validate(
			z.object({
				filePath: V_FilePath,
				options: V_ButtonOptions,
			}),
			{
				filePath: filePath,
				options: options,
			},
		);

		const uuid = getUUID();

		let declaration: ButtonDeclaration;
		if (typeof options.declaration === 'string') {
			declaration = this.buttonParser.fromString(options.declaration);
		} else {
			declaration = this.buttonParser.validate(options.declaration);
		}

		return new ButtonBase(this.plugin, uuid, filePath, declaration, options.position, options.isPreview);
	}

	public createEmbedBase(filePath: string, options: EmbedOptions): EmbedBase {
		validate(
			z.object({
				filePath: V_FilePath,
				options: V_EmbedOptions,
			}),
			{
				filePath: filePath,
				options: options,
			},
		);

		const uuid = getUUID();
		return new EmbedBase(this.plugin, uuid, filePath, options.depth, options.content);
	}

	public createExcludedBase(filePath: string): ExcludedBase {
		validate(
			z.object({
				filePath: V_FilePath,
			}),
			{
				filePath: filePath,
			},
		);

		const uuid = getUUID();
		return new ExcludedBase(this.plugin, uuid, filePath);
	}

	/**
	 * Gets the prefix of a given widget type. (e.g. INPUT or VIEW)
	 *
	 * @param fieldType
	 */
	public getInlineFieldDeclarationPrefix(fieldType: FieldType): string {
		validate(
			z.object({
				fieldType: V_FieldType,
			}),
			{
				fieldType: fieldType,
			},
		);

		if (fieldType === FieldType.INPUT_FIELD) {
			return 'INPUT';
		} else if (fieldType === FieldType.VIEW_FIELD) {
			return 'VIEW';
		} else if (fieldType === FieldType.BUTTON_GROUP) {
			return 'BUTTON';
		}

		throw new MetaBindInternalError({
			errorLevel: ErrorLevel.CRITICAL,
			effect: 'failed to get declaration prefix',
			cause: `Invalid inline mdrc type "${fieldType}"`,
		});
	}

	/**
	 * Checks if a string is a declaration of a given widget type.
	 *
	 * @param fieldType
	 * @param str
	 */
	public isInlineFieldDeclaration(fieldType: FieldType, str: string): boolean {
		validate(
			z.object({
				fieldType: V_FieldType,
				str: z.string(),
			}),
			{
				fieldType: fieldType,
				str: str,
			},
		);

		const startStr: string = this.getInlineFieldDeclarationPrefix(fieldType) + '[';
		const endStr: string = ']';

		return str.startsWith(startStr) && str.endsWith(endStr);
	}

	/**
	 * Checks if a string is any declaration and if yes returns the widget type.
	 * This does not use {@link isInlineFieldDeclaration} because of performance reasons.
	 *
	 * @param str
	 */
	public isInlineFieldDeclarationAndGetType(str: string): InlineFieldType | undefined {
		validate(
			z.object({
				str: z.string(),
			}),
			{
				str: str,
			},
		);

		if (!str.endsWith(']')) {
			return undefined;
		}

		for (const widgetType of Object.values(FieldType)) {
			if (!isFieldTypeAllowedInline(widgetType)) {
				continue;
			}
			const startStr: string = this.getInlineFieldDeclarationPrefix(widgetType) + '[';
			if (str.startsWith(startStr)) {
				return widgetType;
			}
		}

		return undefined;
	}

	public createSignal<T>(value: T): Signal<T> {
		return new Signal<T>(value);
	}

	/**
	 * Creates a bind target declaration.
	 *
	 * @param storageType the storage type (also named metadata source sometimes)
	 * @param storagePath the storage path (usually the file path)
	 * @param property the property path a.b.c = ['a', 'b', 'c']
	 * @param listenToChildren whether to listen to children, only relevant for arrays and objects
	 */
	public createBindTarget(
		storageType: string,
		storagePath: string,
		property: string[],
		listenToChildren: boolean = false,
	): BindTargetDeclaration {
		validate(
			z.object({
				storageType: z.string(),
				storagePath: z.string(),
				property: z.string().array(),
				listenToChildren: z.boolean(),
			}),
			{
				storageType: storageType,
				storagePath: storagePath,
				property: property,
				listenToChildren: listenToChildren,
			},
		);

		return {
			storageType: storageType,
			storagePath: storagePath,
			storageProp: parsePropPath(property),
			listenToChildren: listenToChildren,
		};
	}

	/**
	 * Parses a bind target declaration from a string.
	 *
	 * @param declarationString the string to parse
	 * @param filePath the file path that this bind target is relative to
	 * @param scope optional bind target scope
	 */
	public parseBindTarget(
		declarationString: string,
		filePath: string,
		scope?: BindTargetScope,
	): BindTargetDeclaration {
		validate(
			z.object({
				declarationString: z.string(),
				filePath: V_FilePath,
				scope: V_BindTargetScope.optional(),
			}),
			{
				declarationString: declarationString,
				filePath: filePath,
				scope: scope,
			},
		);

		return this.bindTargetParser.fromStringAndValidate(declarationString, filePath, scope);
	}

	/**
	 * Sets a property in meta binds metadata cache.
	 *
	 * @param bindTarget
	 * @param value
	 */
	public setMetadata(bindTarget: BindTargetDeclaration, value: unknown): void {
		validate(
			z.object({
				bindTarget: V_BindTargetDeclaration,
			}),
			{
				bindTarget: bindTarget,
			},
		);

		this.plugin.metadataManager.write(value, bindTarget);
	}

	/**
	 * Reads a property from meta binds metadata cache.
	 * If the value is not present in the cache, it will check the underlying source. E.g. Obsidians metadata cache.
	 *
	 * @param bindTarget
	 */
	public getMetadata(bindTarget: BindTargetDeclaration): unknown {
		validate(
			z.object({
				bindTarget: V_BindTargetDeclaration,
			}),
			{
				bindTarget: bindTarget,
			},
		);

		return this.plugin.metadataManager.read(bindTarget);
	}

	/**
	 * Updates a property in meta binds metadata cache.
	 *
	 * @param bindTarget
	 * @param updateFn a function that takes the current value and returns the new value
	 */
	public updateMetadata(bindTarget: BindTargetDeclaration, updateFn: (value: unknown) => unknown): void {
		validate(
			z.object({
				bindTarget: V_BindTargetDeclaration,
				updateFn: z.function().args(z.any()).returns(z.any()),
			}),
			{
				bindTarget: bindTarget,
				updateFn: updateFn,
			},
		);

		const value = this.plugin.metadataManager.read(bindTarget);
		const newValue = updateFn(value);
		this.plugin.metadataManager.write(newValue, bindTarget);
	}

	/**
	 * Subscribes to a property in meta binds metadata cache.
	 * This returns a subscription that can be used to unsubscribe as well as update the cache.
	 * IF YOU DON'T CALL `unsubscribe` THE SUBSCRIPTION WILL LEAK MEMORY.
	 *
	 * @param bindTarget
	 * @param callback
	 */
	public subscribeToMetadata(
		bindTarget: BindTargetDeclaration,
		callback: (value: unknown) => void,
	): MetadataSubscription {
		validate(
			z.object({
				bindTarget: V_BindTargetDeclaration,
				callback: z.function().args(z.any()).returns(z.void()),
			}),
			{
				bindTarget: bindTarget,
				callback: callback,
			},
		);

		const uuid = getUUID();
		const signal = new Signal<unknown>(undefined);

		signal.registerListener({
			callback: callback,
		});

		return this.plugin.metadataManager.subscribe(uuid, signal, bindTarget, (): void => {
			signal.unregisterAllListeners();
		});
	}
}
