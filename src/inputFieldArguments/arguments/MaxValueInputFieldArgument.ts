import { AbstractInputFieldArgument } from '../AbstractInputFieldArgument';
import { InputFieldArgumentType, InputFieldType } from '../../parsers/InputFieldDeclarationParser';
import { ErrorLevel, MetaBindParsingError } from '../../utils/errors/MetaBindErrors';

export class MaxValueInputFieldArgument extends AbstractInputFieldArgument {
	identifier: InputFieldArgumentType = InputFieldArgumentType.MAX_VALUE;
	allowedInputFields: InputFieldType[] = [InputFieldType.SLIDER, InputFieldType.PROGRESS_BAR];
	value: number = 100;
	requiresValue: boolean = true;
	allowMultiple: boolean = false;

	parseValue(valueStr: string): void {
		this.value = Number.parseInt(valueStr);
		if (Number.isNaN(this.value)) {
			throw new MetaBindParsingError(ErrorLevel.ERROR, 'failed to set value for input field argument', "value of argument 'maxValue' must be of type number");
		}
	}
}
