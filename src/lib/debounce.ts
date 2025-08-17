export function debounce<Return extends unknown, Parameters extends unknown[]>(
	callback: (parameters: Parameters[]) => Return,
	period: number,
): (...parameters: Parameters) => Promise<Return> {
	let lastCall = 0;

	let currentPromise: Promise<Return> | null = null;
	let currentParameters: Parameters[] = [];

	return (...parameters: Parameters) => {
		if (currentPromise) {
			currentParameters.push(parameters);
			return currentPromise;
		}

		currentPromise = new Promise<Return>((resolve, reject) => {
			const callAndResolve = () => {
				const parameters = currentParameters;
				currentParameters = [];
				try {
					resolve(callback(parameters));
				} catch (error) {
					reject(error);
				}
				currentPromise = null;
			};

			const now = Date.now();
			const timeToWait = lastCall + period - now;
			if (lastCall === 0 || timeToWait < 0 || period <= 0) {
				return callAndResolve();
			}

			currentParameters.push(parameters);

			setTimeout(() => {
				return callAndResolve();
			}, timeToWait);
		});

		return currentPromise;
	};
}

export class Debounce<
	Return extends unknown,
	Parameters extends unknown[] = [],
> {
	constructor(
		public period: number,
		public callback: (...parameters: Parameters) => Return,
	) {}

	protected currentPromise: Promise<Return> | null = null;
	protected currentParameters: Parameters[] = [];

	protected lastCall = 0;
	call(...parameters: Parameters): Promise<Return> {
		if (this.currentPromise && !this.getIfNextCallWillBeImmediate()) {
			this.currentParameters.push(parameters);
			return this.currentPromise;
		}

		this.currentPromise = new Promise<Return>((resolve, reject) => {
			const callAndResolve = (parameters: Parameters) => {
				try {
					resolve(this.callback(...parameters));
				} catch (error) {
					reject(error);
				}
				this.currentPromise = null;
			};

			this.lastCall = performance.now();
			this.currentParameters.push(parameters);

			if (this.getIfNextCallWillBeImmediate()) {
				return callAndResolve(parameters);
			}

			setTimeout(() => {
				return callAndResolve(parameters);
			}, this.getTimeToWait());
		});

		return this.currentPromise;
	}

	getIfNextCallWillBeImmediate(): boolean {
		const timeToWait = this.getTimeToWait();
		return this.lastCall === 0 || timeToWait < 0 || this.period <= 0;
	}

	getTimeToWait(): number {
		const now = performance.now();
		return this.lastCall + this.period - now;
	}
}
