import { Debounce, debounce } from "./debounce";
import { Emitter } from "./Emitter";

/**
 * a thenable with a name and the ability to indicate progress.
 */
export class Progress<T = void> {
	constructor(readonly name?: string) {}

	readonly onStatusUpdate = new Emitter();
	readonly onResolve = new Emitter<[value: T]>();
	readonly onThrow = new Emitter<[value: unknown]>();
	readonly onFinish = new Emitter();

	isThrown = false;
	throwValue: unknown = null;

	isResolved = false;
	resolveValue: T | null = null;

	status: string | null = null;

	setStatus(status: string | null): this {
		this.status = status;
		this.onStatusUpdate.emit();
		return this;
	}

	protected _totalCurrentProgress = 0;
	protected _totalMaximumProgress = 0;

	get totalCurrentProgress() {
		return this.children.length > 0
			? this._totalCurrentProgress
			: this.currentProgress;
	}

	get totalMaximumProgress() {
		return this.children.length > 0
			? this._totalMaximumProgress
			: this.maximumProgress;
	}

	protected _justMyCurrentProgress = 0;
	protected _justMyMaximumProgress = 0;

	get currentProgress() {
		return this._justMyCurrentProgress;
	}

	set currentProgress(value: number) {
		this._justMyCurrentProgress = value;
		this.emitUpdateAndRecalculate();
	}

	get maximumProgress() {
		return this._justMyMaximumProgress;
	}

	set maximumProgress(value: number) {
		this._justMyMaximumProgress = value;
		this.emitUpdateAndRecalculate();
	}

	getTotalPercent() {
		if (this.totalMaximumProgress === 0) {
			return this.isResolved ? 1 : 0;
		} else {
			return this.totalCurrentProgress / this.totalMaximumProgress;
		}
	}

	getPercent() {
		if (this.maximumProgress === 0) {
			return this.isResolved ? 1 : 0;
		} else {
			return this.currentProgress / this.maximumProgress;
		}
	}

	children: Progress<unknown>[] = [];

	// `any` is used here, because if you try to .addChild with a progress that has a different type,
	// it'll fail the duck test to typescript. and it'll complain.
	addChild<P extends Progress<any>>(progress: P): P {
		this.children.push(progress);

		progress.subscribe(() => {
			this.recalculate.call();
		});

		return progress;
	}

	defer<P extends Progress<any>>(progress: P): P {
		const update = () => {
			this.status = progress.toString().substring(0, 70);

			this.setProgress(
				progress.totalCurrentProgress,
				progress.totalMaximumProgress,
			);
		};

		const removeUpdate = progress.subscribe(() => {
			update();
		});

		const cleanup = () => {
			removeUpdate();
		};

		progress.finally(() => {
			cleanup();
		});

		return progress;
	}

	recalculate = new Debounce<void, []>(100, () => {
		if (this.children.length === 0) {
			this._totalCurrentProgress = this._justMyCurrentProgress;
			this._totalMaximumProgress = this._justMyMaximumProgress;

			this.onStatusUpdate.emit();
			return;
		}

		let current = this.getPercent();
		let max = 1;

		for (const sub of this.children) {
			current += sub.getTotalPercent();
			max++;
		}

		this._totalCurrentProgress = current;
		this._totalMaximumProgress = max;

		if (this.isResolved) {
			return;
		}

		this.onStatusUpdate.emit();
	});

	emitUpdateAndRecalculate(): Promise<void> {
		if (this.recalculate.getIfNextCallWillBeImmediate()) {
			return this.recalculate.call();
		} else {
			this.onStatusUpdate.emit();
			return this.recalculate.call();
		}
	}

	unit: ProgressUnit = new ProgressUnit();

	setUnit(unit: ProgressUnit | string): this {
		if (typeof unit === "string") {
			this.unit = new NamedProgressUnit(unit);
		} else {
			this.unit = unit;
		}

		return this;
	}

	setProgress(min: number, max?: number): this {
		this._justMyCurrentProgress = min;

		if (max != null) {
			this._justMyMaximumProgress = max;
		}

		this.emitUpdateAndRecalculate();

		return this;
	}

	resolve(value: T): this {
		if (this.isResolved || this.isThrown) {
			return this;
		}
		this.isResolved = true;
		this.resolveValue = value;
		this.onResolve.emit(value);
		this.onFinish.emit();
		this.recalculate.callback();

		return this;
	}

	throw(value: unknown): this {
		if (this.isResolved || this.isThrown) {
			return this;
		}

		this.isThrown = true;
		this.throwValue = value;
		this.onThrow.emit(value);
		this.onFinish.emit();

		return this;
	}

	toPromise(): Promise<T> {
		return Promise.resolve(this);
	}

	then(
		onFinish: (value: T) => void,
		onThrow?: (value: unknown) => void,
	): this {
		if (this.isResolved) {
			onFinish(this.resolveValue!);
		} else if (this.isThrown) {
			onThrow?.(this.throwValue);
		} else {
			this.onResolve.once((value) => onFinish(value));
			if (onThrow) this.onThrow.once((value) => onThrow(value));
		}

		return this;
	}

	subscribe(callback: (progress: this) => void): () => void {
		callback(this);

		return this.onStatusUpdate.add(() => callback(this));
	}

	catch(onThrow: (value: unknown) => void): this {
		if (this.isThrown) {
			onThrow(this.throwValue);
		} else {
			this.onThrow.once((value) => onThrow(value));
		}

		return this;
	}

	finally(onFinish: () => void): this {
		if (this.isResolved || this.isThrown) {
			onFinish();
		} else {
			this.onFinish.once(() => onFinish());
		}
		return this;
	}

	hookToFunction(callback: (progress: Progress<T>) => Promise<T>): this {
		callback(this)
			.then((value) => {
				this.resolve(value);
			})
			.catch((value) => {
				this.throw(value);
			});

		return this;
	}

	static runAsync<T>(
		name: string | undefined,
		callback: (progress: Progress<T>) => Promise<T>,
	): Progress<T> {
		const progress = new Progress<T>(name);

		progress.hookToFunction(callback);

		return progress;
	}

	toString(): string {
		if (this.status && this.name) {
			return `${this.name} -> ${this.status}`;
		}

		if (this.name) {
			return this.name;
		}

		if (this.status) {
			return this.status;
		}

		return `...`;
	}

	static resolve<T>(value: T, name?: string): Progress<T> {
		const progress = new Progress<T>(name);

		progress.resolve(value);

		return progress;
	}

	static defer<T>(progressToDefer: Progress<T>, name?: string): Progress<T> {
		return this.runAsync(name, async (progress) => {
			return await progress.defer(progressToDefer);
		});
	}

	static deferReturnVoid<T>(
		progressToDefer: Progress<T>,
		name?: string,
	): Progress<void> {
		return this.runAsync(name, async (progress) => {
			await progress.defer(progressToDefer);
		});
	}

	get [Symbol.toStringTag]() {
		return "Progress";
	}
}

export class ProgressUnit {
	render(value: number): string {
		return `${value}`;
	}
}

export class NamedProgressUnit extends ProgressUnit {
	constructor(public name: string) {
		super();
	}

	render(value: number): string {
		return `${value} ${this.name}`;
	}
}

export class ByteProgressUnit extends ProgressUnit {
	constructor() {
		super();
	}

	render(value: number): string {
		return `${value} B`;
	}
}
