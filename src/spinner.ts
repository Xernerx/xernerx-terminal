/** @format */

import chalk from 'chalk';

/**
 * Configuration options for the {@link Spinner} instance.
 */
export interface SpinnerOptions {
	/** Text displayed next to the spinner indicator. */
	text?: string;
	/** Whether the spinner animation and output are enabled. */
	isEnabled?: boolean;
	/** Custom animation frames cycled while spinning. */
	frames?: string[];
}

/**
 * Lightweight, TTY-aware terminal spinner.
 */
export class Spinner {
	/** Whether the spinner interval is currently active. */
	public isSpinning: boolean = false;
	/** Default text displayed alongside the active spinner frame. */
	public text: string = '';

	private interval: NodeJS.Timeout | null = null;
	private frames: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
	private currentFrame: number = 0;
	private isEnabled: boolean;
	private isTTY: boolean = process.stdout.isTTY === true;
	private exitListenerRegistered: boolean = false;

	/**
	 * Creates a new {@link Spinner} instance.
	 * @param options - Optional configuration for spinner text, state, and frames.
	 */
	constructor(options: SpinnerOptions = {}) {
		this.text = options.text || '';
		this.isEnabled = options.isEnabled !== false;
		if (options.frames && options.frames.length > 0) {
			this.frames = options.frames;
		}
	}

	private registerExitCleanup() {
		if (this.exitListenerRegistered || !this.isTTY) return;
		this.exitListenerRegistered = true;
		process.once('exit', () => {
			this.clear();
		});
	}

	private render() {
		if (!this.isEnabled) return;
		const frame = chalk.cyan(this.frames[this.currentFrame]);
		if (this.isTTY) {
			const suffix = this.text ? ` ${this.text}` : '';
			process.stdout.write(`\r\x1b[K${frame}${suffix}`);
		}
		this.currentFrame = (this.currentFrame + 1) % this.frames.length;
	}

	/**
	 * Clears the current spinner line from the terminal if running in a TTY.
	 */
	public clear() {
		if (!this.isEnabled || !this.isTTY) return;
		process.stdout.write('\r\x1b[K');
	}

	/**
	 * Starts the spinner animation.
	 * @param text - Optional new default text for the spinner.
	 */
	public start(text?: string) {
		if (text !== undefined) this.text = text;
		if (!this.isEnabled) return this;

		if (!this.isSpinning) {
			this.isSpinning = true;
			if (this.isTTY) {
				this.registerExitCleanup();
				this.render();
				this.interval = setInterval(() => this.render(), 80);
				this.interval.unref();
			}
		}
		return this;
	}

	/**
	 * Stops the spinner animation and clears the line.
	 */
	public stop() {
		if (!this.isEnabled) return this;
		if (this.isSpinning) {
			if (this.interval) clearInterval(this.interval);
			this.interval = null;
			this.isSpinning = false;
			this.clear();
		}
		return this;
	}

	private persist(symbol: string, text?: string, color?: (str: string) => string) {
		const outputText = text !== undefined ? text : this.text;
		this.stop();
		if (!this.isEnabled) return this;

		const formattedSymbol = color ? color(symbol) : symbol;
		console.log(`${formattedSymbol} ${outputText}`);
		return this;
	}

	/**
	 * Stops the spinner and persists a green success (`✔`) line.
	 * @param text - Message to display.
	 */
	public succeed(text?: string) {
		return this.persist('✔', text, chalk.green);
	}

	/**
	 * Stops the spinner and persists a red failure (`✖`) line.
	 * @param text - Message to display.
	 */
	public fail(text?: string) {
		return this.persist('✖', text, chalk.red);
	}

	/**
	 * Stops the spinner and persists a blue info (`ℹ`) line.
	 * @param text - Message to display.
	 */
	public info(text?: string) {
		return this.persist('ℹ', text, chalk.blue);
	}

	/**
	 * Stops the spinner and persists a yellow warning (`⚠`) line.
	 * @param text - Message to display.
	 */
	public warn(text?: string) {
		return this.persist('⚠', text, chalk.yellow);
	}
}
