/** @format */

import ora, { Ora, Options as OraOptions } from 'ora';
import chalk from 'chalk';
import boxen, { Options } from 'boxen';
import util from 'util';

type Format = 'title' | 'date' | 'time' | 'datetime' | 'relative' | 'duration' | 'level' | 'env' | 'pid' | 'memory' | 'uptime' | 'scope' | 'tag' | 'icon';

interface TerminalOptions {
	format?: Array<Format>;
	title?: string;
	level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
	scope?: string;
	tag?: string;
	icon?: string;
	requestId?: string;

	_spinnerInstance?: Ora;
	spinner?: OraOptions['spinner'];
	spinnerText?: string;
	spin?: boolean;
}

export class Terminal {
	public readonly now: Date;
	public readonly format: Array<Format>;
	public readonly title: string;
	public readonly level: TerminalOptions['level'];
	public readonly scope?: string;
	public readonly tag?: string;
	public readonly icon?: string;
	public readonly requestId?: string;

	public readonly prefix: () => string;

	private spinner: Ora;
	private spinEnabled: boolean;

	private prefixFormat = {
		title: () => chalk.magenta.bold(this.title),

		date: () => chalk.dim(new Date().toLocaleDateString()),
		time: () => chalk.dim(new Date().toLocaleTimeString()),
		datetime: () => chalk.dim(new Date().toLocaleString()),

		relative: () => chalk.gray(`${Math.floor((Date.now() - this.now.getTime()) / 1000)}s`),

		duration: () => chalk.gray(`${Date.now() - this.now.getTime()}ms`),

		level: () => {
			switch (this.level) {
				case 'DEBUG':
					return chalk.gray.bold('DEBUG');
				case 'WARN':
					return chalk.yellow.bold('WARN');
				case 'ERROR':
					return chalk.red.bold('ERROR');
				default:
					return chalk.blue.bold('INFO');
			}
		},

		env: () => chalk.cyan(process.env.NODE_ENV || 'dev'),

		pid: () => chalk.gray(`#${process.pid}`),

		memory: () => chalk.green(`${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`),

		uptime: () => chalk.gray(`${Math.floor(process.uptime())}s`),

		scope: () => chalk.cyan(this.scope || ''),

		tag: () => (this.tag ? chalk.white.bold(this.tag) : ''),

		icon: () => this.icon || '',
	};

	constructor(options: TerminalOptions = {}) {
		this.now = new Date();
		this.title = options.title || 'XERNERX';
		this.format = options.format || ['title', 'scope', 'time', 'memory', 'duration', 'uptime'];

		this.level = options.level || 'INFO';
		this.scope = options.scope;
		this.tag = options.tag;
		this.icon = options.icon;
		this.requestId = options.requestId;

		this.prefix = () =>
			this.format
				.map((format) => this.prefixFormat[format]())
				.filter(Boolean)
				.join(' | ');

		this.spinEnabled = options.spin !== false;

		this.spinner =
			options._spinnerInstance ??
			ora({
				text: options.spinnerText || '',
				spinner: options.spinner || 'dots',
				isEnabled: this.spinEnabled,
			});

		if (this.spinEnabled && !options._spinnerInstance) {
			this.spinner.start();
		}
	}

	/* ================= INTERNAL ================= */

	private parseError(err: Error) {
		const stack = err.stack?.split('\n') || [];

		const line = stack[1]?.trim() || '';

		// Handles both:
		// at file:///path:line:col
		// at func (file:///path:line:col)
		const match = line.match(/at\s+(?:.*\()?(.+):(\d+):(\d+)\)?$/);

		if (!match) {
			return {
				message: err.message,
				filepath: 'unknown',
				line: '0',
				column: '0',
			};
		}

		return {
			message: err.message,
			filepath: match[1],
			line: match[2],
			column: match[3],
		};
	}

	private formatMessage(args: any[]): string {
		const prefix = this.prefix();

		const message = args
			.map((arg) =>
				typeof arg === 'string'
					? arg
					: util.inspect(arg, {
							colors: true,
							depth: null,
						})
			)
			.join(' ');

		return `${prefix} | ${message}`;
	}

	private writeLine(symbol: 'info' | 'warn' | 'fail', message: string) {
		if (!this.spinEnabled) {
			// fallback to plain output
			const method = symbol === 'fail' ? console.error : symbol === 'warn' ? console.warn : console.log;

			method(message);
			return;
		}

		if (this.spinner.isSpinning) {
			this.spinner.stop();
		}

		this.spinner[symbol](message);
		this.spinEnabled && this.spinner.start();
	}

	/* ================= LOG METHODS ================= */

	public child(options: Partial<TerminalOptions>) {
		return new Terminal({
			title: this.title,
			format: this.format,
			level: this.level,
			scope: options.scope ?? this.scope,
			tag: options.tag ?? this.tag,
			icon: options.icon ?? this.icon,
			requestId: options.requestId ?? this.requestId,
			spin: this.spinEnabled,

			// THIS is the important part
			_spinnerInstance: this.spinner,

			...options,
		});
	}

	public clear() {
		console.clear();
	}

	public box(text: string, options?: Options) {
		console.info(
			boxen(chalk.magenta.bold(text || this.title), {
				borderStyle: 'round',
				height: 2,
				borderColor: 'magenta',
				dimBorder: true,
				fullscreen: (h, w) => [h, w],
				textAlignment: 'center',
				...options,
			})
		);
	}

	public log<T>(...args: T[]): void {
		this.writeLine('info', this.formatMessage(args));
	}

	public info<T>(...args: T[]): void {
		this.writeLine('info', this.formatMessage(args));
	}

	public warn<T>(...args: T[]): void {
		this.writeLine('warn', this.formatMessage(args));
	}

	public error(...args: any[]): void {
		const formatted = args.map((arg) => {
			if (typeof arg === 'string') return arg;

			if (!(arg instanceof Error)) {
				return util.inspect(arg, { colors: true, depth: 2 });
			}

			if (arg instanceof Error) {
				const parsed = this.parseError(arg);

				return chalk.red.bold(`${parsed.message} (${parsed.filepath}:${parsed.line}:${parsed.column})`);
			}

			return String(arg);
		});

		this.writeLine('fail', `${this.prefix()} | ${formatted.join(' ')}`);
	}

	public debug<T>(...args: T[]): void {
		if (this.level === 'DEBUG') {
			this.writeLine('info', this.formatMessage(args));
		}
	}

	public table(data: any[]) {
		console.table(data);
	}

	private timers = new Map<string, number>();

	public time(label: string) {
		this.timers.set(label, Date.now());
	}

	public timeEnd(label: string) {
		const start = this.timers.get(label);
		if (!start) return;

		const duration = Date.now() - start;
		this.info(`${label} took ${duration}ms`);
		this.timers.delete(label);
	}

	/* ================= OPTIONAL CONTROL ================= */

	public start(text?: string): void {
		if (!this.spinEnabled) return;
		this.spinner.start(`${this.prefix()} | ${text || ''}`);
	}

	public stop(): void {
		if (!this.spinEnabled) return;
		this.spinner.stop();
	}

	public succeed(text?: string): void {
		if (!this.spinEnabled) return;
		this.spinner.succeed(`${this.prefix()} | ${text || ''}`);
	}

	public fail(text?: string): void {
		if (!this.spinEnabled) return;
		this.spinner.fail(`${this.prefix()} | ${text || ''}`);
	}
}

export const terminal = new Terminal();
