import { InputFieldConfig, InputFieldConfigs, InputFieldType } from '../InputFieldConfigs';
import { InputFieldMDRC, RenderChildType } from '../../renderChildren/InputFieldMDRC';
import { ErrorLevel, MetaBindParsingError } from '../../utils/errors/MetaBindErrors';
import { IPlugin } from '../../IPlugin';
import { Toggle } from './fields/Toggle/Toggle';
import { Text } from './fields/Text/Text';
import { Slider } from './fields/Slider/Slider';
import { TextArea } from './fields/TextArea/TextArea';
import { Select } from './fields/Select/Select';
import { MultiSelect } from './fields/MultiSelect/MultiSelect';
import { DatePicker } from './fields/DatePicker/DatePicker';

export type NewInputField = Toggle | Slider | Text | TextArea | Select | MultiSelect | DatePicker;

export class NewInputFieldFactory {
	plugin: IPlugin;

	constructor(plugin: IPlugin) {
		this.plugin = plugin;
	}

	createInputField(type: InputFieldType, renderChildType: RenderChildType, renderChild: InputFieldMDRC): NewInputField | undefined {
		if (type !== InputFieldType.INVALID) {
			this.checkRenderChildTypeAllowed(type, renderChildType);
		}

		// Skipped: Date, Time

		if (type === InputFieldType.TOGGLE) {
			return new Toggle(renderChild);
		} else if (type === InputFieldType.SLIDER) {
			return new Slider(renderChild);
		} else if (type === InputFieldType.TEXT) {
			return new Text(renderChild);
		} else if (type === InputFieldType.TEXT_AREA) {
			return new TextArea(renderChild);
		} else if (type === InputFieldType.TEXT_AREA_DEPRECATED) {
			return new TextArea(renderChild);
		} else if (type === InputFieldType.SELECT) {
			return new Select(renderChild);
		} else if (type === InputFieldType.MULTI_SELECT) {
			return new MultiSelect(renderChild);
		} else if (type === InputFieldType.MULTI_SELECT_DEPRECATED) {
			return new MultiSelect(renderChild);
		} else if (type === InputFieldType.DATE_PICKER) {
			return new DatePicker(renderChild);
		} else if (type === InputFieldType.DATE_PICKER_DEPRECATED) {
			return new DatePicker(renderChild);
		}

		return undefined;
	}

	checkRenderChildTypeAllowed(type: InputFieldType, renderChildType: RenderChildType): void {
		if (this.plugin.settings.ignoreCodeBlockRestrictions) {
			return;
		}

		const inputFieldConfig: InputFieldConfig = InputFieldConfigs[type];
		if (renderChildType === RenderChildType.BLOCK && !inputFieldConfig.allowInBlock) {
			throw new MetaBindParsingError(ErrorLevel.CRITICAL, 'can not create input field', `'${type}' is not allowed as code block`);
		}
		if (renderChildType === RenderChildType.INLINE && !inputFieldConfig.allowInline) {
			throw new MetaBindParsingError(ErrorLevel.CRITICAL, 'can not create input field', `'${type}' is not allowed as inline code block`);
		}
	}
}
