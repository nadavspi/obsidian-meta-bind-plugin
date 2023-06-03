import { CachedMetadata, TFile } from 'obsidian';
import MetaBindPlugin from './main';
import { Internal } from '@opd-libs/opd-metadata-lib/lib/Internal';
import { arrayEquals, traverseObjectToParentByPath } from './utils/Utils';
import { traverseObjectByPath } from '@opd-libs/opd-utils-lib/lib/ObjectTraversalUtils';
import { Listener, Signal } from './utils/Signal';
import getMetadataFromFileCache = Internal.getMetadataFromFileCache;

export interface MetadataFileCacheListener extends Listener<any | undefined> {
	metadataPath: string[];
}

export interface MetadataFileCache {
	file: TFile;
	metadata: Record<string, any>;
	listeners: MetadataFileCacheListener[];
	cyclesSinceLastUserInput: number;
	changed: boolean;
}

export class MetadataManager {
	cache: MetadataFileCache[];
	plugin: MetaBindPlugin;
	updateCycleThreshold = 5;
	interval: number | undefined;

	constructor(plugin: MetaBindPlugin) {
		this.plugin = plugin;

		this.cache = [];

		this.plugin.registerEvent(this.plugin.app.metadataCache.on('changed', this.updateCacheOnFrontmatterUpdate.bind(this)));

		this.interval = window.setInterval(() => this.update(), this.plugin.settings.syncInterval);
	}

	register(file: TFile, signal: Signal<any | undefined>, metadataPath: string[], uuid: string): MetadataFileCache {
		const fileCache: MetadataFileCache | undefined = this.getCacheForFile(file);
		if (fileCache) {
			console.debug(`meta-bind | MetadataManager >> registered ${uuid} to existing file cache ${file.path} -> ${metadataPath}`);
			fileCache.listeners.push({
				callback: (value: any) => signal.set(value),
				metadataPath: metadataPath,
				uuid: uuid,
			});
			signal.set(traverseObjectByPath(metadataPath, fileCache.metadata));
			return fileCache;
		} else {
			console.debug(`meta-bind | MetadataManager >> registered ${uuid} to newly created file cache ${file.path} -> ${metadataPath}`);
			const c: MetadataFileCache = {
				file: file,
				metadata: getMetadataFromFileCache(file, this.plugin),
				listeners: [
					{
						callback: (value: any) => signal.set(value),
						metadataPath: metadataPath,
						uuid: uuid,
					},
				],
				cyclesSinceLastUserInput: 0,
				changed: false,
			};
			console.log(`meta-bind | MetadataManager >> loaded metadata for file ${file.path}`, c.metadata);
			signal.set(traverseObjectByPath(metadataPath, c.metadata));

			this.cache.push(c);
			return c;
		}
	}

	unregister(file: TFile, uuid: string): void {
		const fileCache = this.getCacheForFile(file);
		if (!fileCache) {
			return;
		}

		console.debug(`meta-bind | MetadataManager >> unregistered ${uuid} to from file cache ${file.path}`);

		fileCache.listeners = fileCache.listeners.filter(x => x.uuid !== uuid);
		if (fileCache.listeners.length === 0) {
			console.debug(`meta-bind | MetadataManager >> deleted unused file cache ${file.path}`);
			this.cache = this.cache.filter(x => x.file.path !== file.path);
		}
	}

	getCacheForFile(file: TFile): MetadataFileCache | undefined {
		return this.cache.find(x => x.file.path === file.path);
	}

	private update(): void {
		// console.debug('meta-bind | updating metadata manager');

		for (const entry of this.cache) {
			if (entry.changed) {
				this.updateFrontmatter(entry);
			}
			entry.cyclesSinceLastUserInput += 1;
		}
	}

	async updateFrontmatter(fileCache: MetadataFileCache): Promise<void> {
		console.debug(`meta-bind | MetadataManager >> updating frontmatter of "${fileCache.file.path}" to`, fileCache.metadata);
		await this.plugin.app.fileManager.processFrontMatter(fileCache.file, frontMatter => {
			fileCache.changed = false;
			Object.assign(frontMatter, fileCache.metadata);
		});
	}

	updateCache(metadata: Record<string, any>, file: TFile, uuid?: string | undefined): void {
		console.debug(`meta-bind | MetadataManager >> updating metadata in ${file.path} metadata cache to`, metadata);

		const fileCache = this.getCacheForFile(file);
		if (!fileCache) {
			return;
		}

		fileCache.metadata = metadata;
		fileCache.cyclesSinceLastUserInput = 0;

		this.notifyListeners(fileCache, undefined, uuid);
	}

	updatePropertyInCache(value: any, pathParts: string[], file: TFile, uuid?: string | undefined): void {
		console.debug(`meta-bind | MetadataManager >> updating "${JSON.stringify(pathParts)}" in "${file.path}" metadata cache to`, value);
		// console.trace();

		const fileCache = this.getCacheForFile(file);
		if (!fileCache) {
			return;
		}

		const { parent, child } = traverseObjectToParentByPath(pathParts, fileCache.metadata);

		if (parent.value === undefined) {
			throw Error(`The parent of "${JSON.stringify(pathParts)}" does not exist in Object, please create the parent first`);
		}

		if (child.value === value) {
			console.debug(`meta-bind | MetadataManager >> skipping redundant update of "${JSON.stringify(pathParts)}" in "${file.path}" metadata cache`, value);
			return;
		}

		parent.value[child.key] = value;
		fileCache.cyclesSinceLastUserInput = 0;
		fileCache.changed = true;

		this.notifyListeners(fileCache, pathParts, uuid);
	}

	updateCacheOnFrontmatterUpdate(file: TFile, data: string, cache: CachedMetadata): void {
		const fileCache = this.getCacheForFile(file);
		if (!fileCache) {
			return;
		}

		// don't update if the user recently changed the cache
		if (fileCache.cyclesSinceLastUserInput < this.updateCycleThreshold) {
			return;
		}

		const metadata: Record<string, any> = Object.assign({}, cache.frontmatter); // copy
		delete metadata.position;

		console.debug(`meta-bind | MetadataManager >> updating "${file.path}" on frontmatter update`, metadata);

		fileCache.metadata = metadata;
		fileCache.cyclesSinceLastUserInput = 0;
		// fileCache.changed = true;

		this.notifyListeners(fileCache);
	}

	notifyListeners(fileCache: MetadataFileCache, metadataPath?: string[] | undefined, exceptUuid?: string | undefined): void {
		let value;
		if (metadataPath) {
			value = traverseObjectByPath(metadataPath, fileCache.metadata);
		}

		// console.log(fileCache);

		for (const listener of fileCache.listeners) {
			if (exceptUuid && exceptUuid === listener.uuid) {
				continue;
			}

			if (metadataPath) {
				if (arrayEquals(metadataPath, listener.metadataPath)) {
					console.debug(`meta-bind | MetadataManager >> notifying input field ${listener.uuid} of updated metadata`);
					listener.callback(value);
				}
			} else {
				console.debug(`meta-bind | MetadataManager >> notifying input field ${listener.uuid} of updated metadata`);
				listener.callback(traverseObjectByPath(listener.metadataPath, fileCache.metadata));
			}
		}
	}
}
