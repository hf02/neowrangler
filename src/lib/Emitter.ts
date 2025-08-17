// Emitter - because Event was taken by the DOM
export class Emitter<T extends unknown[] = []> {
	protected _subscriptions: ((...args: T) => void)[] = [];

	/**
	 * adds a listener
	 * @param listener the listener to add
	 * @returns a function that removes the listener when called
	 */
	add(listener: (typeof this._subscriptions)[number]): () => void {
		this.remove(listener);
		this._subscriptions.push(listener);

		return () => this.remove(listener);
	}

	/**
	 * removes a listener
	 * @param listener the listener to remove
	 * @returns true if found, false if not.
	 */
	remove(listener: (typeof this._subscriptions)[number]): boolean {
		for (let i = 0; i < this._subscriptions.length; i++) {
			const subscription = this._subscriptions[i];
			if (subscription === listener) {
				this._subscriptions.splice(i, 1);
				return true;
			}
		}

		return false;
	}

	/**
	 * emits the emitter.
	 * @param args arguments passed to subscriptions
	 */
	emit(...args: T) {
		const subscriptions = [...this._subscriptions];

		for (const subscription of subscriptions) {
			try {
				subscription(...args);
			} catch (e) {
				// what should we do with errors in an emitter? it ain't the code calling emit()'s fault...
				console.error(e);
			}
		}
	}

	/**
	 * returns a promise that resolves when an emit happens
	 * @returns the arguments given to the callback
	 */
	wait() {
		return new Promise<T>((resolve) => {
			this.once((...args) => {
				resolve(args);
			});
		});
	}

	/**
	 * adds a listener, and removes it upon first emit
	 * @param listener the listener to add
	 * @returns a function that removes the listener when called
	 */
	once(listener: (typeof this._subscriptions)[number]): () => void {
		const removeListener = this.add(listener);
		const callback = () => {
			// ensure that the subscription is still before this remove callback in _subscriptions.
			// because if it isn't, someone removed it and then added it again later, and us
			// removing it here would prevent it from being called.
			if (
				this._subscriptions.indexOf(removeListener) <
				this._subscriptions.indexOf(callback)
			) {
				removeListener();
			}
			removeSelf();
		};
		const removeSelf = this.add(callback);

		return removeListener;
	}
}
