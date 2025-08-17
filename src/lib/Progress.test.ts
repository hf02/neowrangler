import { Progress } from "./Progress.js";

describe("Progress", () => {
	const createContext = () => {
		const resolveMockCallback = jest.fn((x) => {});
		const throwMockCallback = jest.fn((x) => {});

		const symbol = Symbol("resolve");

		const progress = new Progress<symbol>("test");

		const expectToHaveResolved = () => {
			expect(resolveMockCallback.mock.calls).toHaveLength(1);
			expect(resolveMockCallback.mock.calls[0]?.[0]).toBe(symbol);
		};

		return {
			progress,
			symbol,
			expectToHaveResolved,
			resolveMockCallback,
		};
	};

	describe("resolves", () => {
		test("using .then (resolving afterwards)", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.then(resolveMockCallback);

			progress.resolve(symbol);

			expectToHaveResolved();
		});

		test("using .then (resolving beforehand)", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.resolve(symbol);

			progress.then(resolveMockCallback);

			expectToHaveResolved();
		});

		test("using event", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.onResolve.add(resolveMockCallback);

			progress.resolve(symbol);

			expectToHaveResolved();
		});

		test("using .toPromise", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.resolve(symbol);

			return progress.toPromise().then((v) => {
				resolveMockCallback(v);
				expectToHaveResolved();
			});
		});

		test("using async/await", (done) => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			(async () => {
				resolveMockCallback(await progress);
				expectToHaveResolved();
				done();
			})();

			progress.resolve(symbol);
		});

		test("only once", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.then(resolveMockCallback);

			progress.resolve(symbol);
			progress.resolve(symbol);
			progress.resolve(symbol);

			expectToHaveResolved();
		});
	});

	describe("throws", () => {
		test("using .catch (throwing beforehand)", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.throw(symbol);

			progress.catch(resolveMockCallback);

			expectToHaveResolved();
		});

		test("using .catch (throwing afterwards)", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.catch(resolveMockCallback);
			progress.throw(symbol);

			expectToHaveResolved();
		});

		test("using .then (throwing beforehand)", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.throw(symbol);

			progress.then(() => {}, resolveMockCallback);

			expectToHaveResolved();
		});

		test("using .then (throwing afterwards)", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.then(() => {}, resolveMockCallback);
			progress.throw(symbol);

			expectToHaveResolved();
		});

		test("using event", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.onThrow.add(resolveMockCallback);

			progress.throw(symbol);

			expectToHaveResolved();
		});

		test("using .toPromise", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.throw(symbol);

			return progress.toPromise().catch((v) => {
				resolveMockCallback(v);
				expectToHaveResolved();
			});
		});

		test("using async/await", (done) => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			(async () => {
				try {
					await progress;
				} catch (e) {
					resolveMockCallback(e);
				}
				expectToHaveResolved();
				done();
			})();

			progress.throw(symbol);
		});

		test("only once", () => {
			const {
				progress,
				symbol,
				expectToHaveResolved,
				resolveMockCallback,
			} = createContext();

			progress.catch(resolveMockCallback);

			progress.throw(symbol);
			progress.throw(symbol);
			progress.throw(symbol);

			expectToHaveResolved();
		});
	});

	describe("updates", () => {
		const testIfUpdated = (
			text: string,
			callCount: number,
			callback: (progress: Progress<void>) => void,
		) => {
			test(text, () => {
				const progress = new Progress<void>("test");

				const mockFunction = jest.fn(() => {});

				progress.subscribe(() => mockFunction());

				expect(mockFunction.mock.calls).toHaveLength(1);

				callback(progress);

				expect(mockFunction.mock.calls.length).toEqual(callCount);
			});
		};

		testIfUpdated("from currentProgress", 2, (progress) => {
			progress.currentProgress += 1;
		});

		testIfUpdated("from maximumProgress", 2, (progress) => {
			progress.maximumProgress += 1;
		});

		testIfUpdated("from setProgress (without max)", 2, (progress) => {
			progress.setProgress(1);
		});

		testIfUpdated("from setProgress (with max)", 2, (progress) => {
			progress.setProgress(0, 1);
		});

		testIfUpdated("from setStatus", 2, (progress) => {
			progress.setStatus("status");
		});

		testIfUpdated("from event", 2, (progress) => {
			progress.onStatusUpdate.emit();
		});

		testIfUpdated("from recalculate", 2, (progress) => {
			progress.recalculate.call();
		});

		testIfUpdated("from defer", 2, (progress) => {
			const progressToDefer = new Progress("name");
			progress.defer(progressToDefer);
		});
	});

	describe("runAsync", () => {
		test("resolves", (done) => {
			const { symbol, expectToHaveResolved, resolveMockCallback } =
				createContext();

			const progress = Progress.runAsync("test", async (progress) => {
				return symbol;
			});

			progress.then((v) => {
				resolveMockCallback(v);
				expectToHaveResolved();
				done();
			});
		});

		test("throws", (done) => {
			const { symbol, expectToHaveResolved, resolveMockCallback } =
				createContext();

			const progress = Progress.runAsync("test", async (progress) => {
				throw symbol;
			});

			progress.catch((v) => {
				resolveMockCallback(v);
				expectToHaveResolved();
				done();
			});
		});
	});
});
