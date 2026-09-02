/** @format */

import chalk from 'chalk';

export class Spinner {
	public isSpinning: boolean = false;
	public text: string = '';
	private interval: NodeJS.Timeout | null = null;
	private frames: string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
	private currentFrame: number = 0;
	private isEnabled: boolean;
	private isTTY: boolean = process.stdout.isTTY === true;

	constructor(options: { text?: string; isEnabled?: boolean; frames?: string[] } = {}) {
		this.text = options.text || '';
		this.isEnabled = options.isEnabled !== false;
		if (options.frames) {
			this.frames = options.frames;
		}
	}

	private render() {
		if (!this.isEnabled) return;
		const frame = chalk.cyan(this.frames[this.currentFrame]);
		if (this.isTTY) {
			process.stdout.write(`\r\x1b[K${frame} ${this.text}`);
		} else {
			// If not a TTY, we might not want to spam logs, but we just print once?
			// Actually, if not TTY, spinner shouldn't spin, but we can respect it if we want.
			// ora handles non-TTY gracefully. We just won't print frames.
		}
		this.currentFrame = (this.currentFrame + 1) % this.frames.length;
	}

	private clear() {
		if (!this.isEnabled || !this.isTTY) return;
		process.stdout.write('\r\x1b[K');
	}

	public start(text?: string) {
		if (text !== undefined) this.text = text;
		if (!this.isEnabled) return this;

		if (!this.isSpinning) {
			this.isSpinning = true;
			if (this.isTTY) {
				this.render();
				this.interval = setInterval(() => this.render(), 80);
			}
		}
		return this;
	}

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
		if (text !== undefined) this.text = text;
		this.stop();
		if (!this.isEnabled) return this;

		const formattedSymbol = color ? color(symbol) : symbol;
		console.log(`${formattedSymbol} ${this.text}`);
		return this;
	}

	public succeed(text?: string) {
		return this.persist('✔', text, chalk.green);
	}

	public fail(text?: string) {
		return this.persist('✖', text, chalk.red);
	}

	public info(text?: string) {
		return this.persist('ℹ', text, chalk.blue);
	}

	public warn(text?: string) {
		return this.persist('⚠', text, chalk.yellow);
	}
}
