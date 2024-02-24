import { type FieldBase } from 'packages/core/src/fields/FieldBase';
import { type MetaBindPublishPlugin } from 'packages/publish/src/main';
import { getUUID } from 'packages/core/src/utils/Utils';
import { MarkdownRenderChild } from 'obsidian/publish';

export class PublishFieldMDRC extends MarkdownRenderChild {
	readonly plugin: MetaBindPublishPlugin;
	readonly base: FieldBase;
	readonly uuid: string;
	readonly filePath: string;

	constructor(plugin: MetaBindPublishPlugin, base: FieldBase, containerEl: HTMLElement) {
		super(containerEl);

		this.plugin = plugin;
		this.base = base;

		this.uuid = getUUID();
		this.filePath = base.getFilePath();
	}

	onload(): void {
		this.base.mount(this.containerEl);

		super.onload();
	}

	onunload(): void {
		this.base.unmount();

		super.onunload();
	}
}
