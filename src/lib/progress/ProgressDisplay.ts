import { Debounce } from "../debounce.js";
import { Progress } from "../Progress.js";

export class ProgressDisplay {
	constructor(readonly progress: Progress<unknown>) {}

	redrawFromProgressUpdate = new Debounce(100, () => {
		this.redraw();
	});

	redraw() {
		if (!this.running) return;
		const totalPercent = this.progress.getTotalPercent();
		const percentString = totalPercent.toFixed(1) + "%";
		console.log(
			`(${percentString.padStart(6)}) ${this.progress.toString()}`,
		);
	}

	running = false;

	protected _progressUnsub = () => {};

	start() {
		this.running = true;
		this._progressUnsub = this.progress.subscribe(() => {
			this.redrawFromProgressUpdate.call();
		});
	}

	stop() {
		this.running = false;
		this._progressUnsub();
	}
}
