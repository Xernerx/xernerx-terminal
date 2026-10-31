/** @format */

import chalk from 'chalk';
import boxen, { Options } from 'boxen';
import fs from 'node:fs';
import path from 'node:path';
import util from 'util';
import { Spinner, SpinnerOptions } from './spinner.js';

export { Spinner, type SpinnerOptions };

/**
 * Package descriptor accepted by {@link Terminal.update}.
 */
export interface UpdatePackageInput {
	/** NPM package name (e.g., `'@xernerx/framework'` or `'xernerx'`). */
	name?: string;
	/** Currently installed version of the package (e.g., `'1.1.1'`). */
	version?: string;
}

const registeredUpdatePackages = new Map<string, string | undefined>();
let activeUpdateCheck: Promise<void> | null = null;

/**
 * Available metadata tokens that can be included in a {@link Terminal} log prefix.
 */
export type Format = 'title' | 'date' | 'time' | 'datetime' | 'relative' | 'duration' | 'level' | 'env' | 'pid' | 'memory' | 'uptime' | 'scope' | 'tag' | 'icon' | 'requestId';

/**
 * Supported severity levels for {@link Terminal} output.
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Configuration options for initializing a {@link Terminal} logger instance.
 */
export interface TerminalOptions {
	/** Ordered list of prefix segments to render before each log message. */
	format?: Array<Format>;
	/** Primary application or brand title shown in the prefix and banner box. */
	title?: string;
	/** Minimum or active log level (`DEBUG` enables `.debug()` output). */
	level?: LogLevel;
	/** Module or service scope label (e.g., `'WS'`, `'DB'`, `'AUTH'`). */
	scope?: string;
	/** Secondary bold tag label for categorizing logs. */
	tag?: string;
	/** Optional icon or emoji rendered in the prefix. */
	icon?: string;
	/** Optional request or correlation ID rendered when `'requestId'` is in `format`. */
	requestId?: string;

	/** Internal shared spinner instance passed to child loggers. */
	_spinnerInstance?: Spinner;
	/** Custom spinner frame characters. */
	spinner?: string | string[];
	/** Idle text shown next to the active spinner. */
	spinnerText?: string;
	/** Whether the interactive CLI spinner is enabled (defaults to `true`). */
	spin?: boolean;
}

/**
 * Formatted CLI logger and interactive terminal controller for Xernerx projects.
 */
export class Terminal {
	/** Timestamp when this terminal instance was created. */
	public readonly now: Date;
	/** Active prefix format segments. */
	public readonly format: Array<Format>;
	/** Title displayed in the prefix and default `.box()` header. */
	public readonly title: string;
	/** Active log level for this instance. */
	public readonly level: LogLevel;
	/** Optional module or service scope name. */
	public readonly scope?: string;
	/** Optional secondary tag label. */
	public readonly tag?: string;
	/** Optional prefix icon. */
	public readonly icon?: string;
	/** Optional request correlation identifier. */
	public readonly requestId?: string;

	/** Generates the formatted, pipe-delimited prefix string for the current moment. */
	public readonly prefix: () => string;

	private spinner: Spinner;
	private spinEnabled: boolean;

	private prefixFormat: Record<Format, () => string> = {
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

		scope: () => (this.scope ? chalk.cyan(this.scope) : ''),

		tag: () => (this.tag ? chalk.white.bold(this.tag) : ''),

		icon: () => this.icon || '',

		requestId: () => (this.requestId ? chalk.gray(`[${this.requestId}]`) : ''),
	};

	/**
	 * Creates a new {@link Terminal} logger instance.
	 * @param options - Configuration options for formatting, scope, and spinner behavior.
	 */
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
				.map((format) => this.prefixFormat[format]?.() ?? '')
				.filter(Boolean)
				.join(' | ');

		this.spinEnabled = options.spin !== false;

		this.spinner =
			options._spinnerInstance ??
			new Spinner({
				text: options.spinnerText || '',
				isEnabled: this.spinEnabled,
				frames: Array.isArray(options.spinner) ? options.spinner : undefined,
			});

		if (this.spinEnabled && !options._spinnerInstance) {
			this.spinner.start();
		}

		// Bind methods so they can be passed directly as callbacks (e.g., `.catch(terminal.error)`)
		this.child = this.child.bind(this);
		this.clear = this.clear.bind(this);
		this.box = this.box.bind(this);
		this.log = this.log.bind(this);
		this.info = this.info.bind(this);
		this.warn = this.warn.bind(this);
		this.error = this.error.bind(this);
		this.debug = this.debug.bind(this);
		this.table = this.table.bind(this);
		this.time = this.time.bind(this);
		this.timeEnd = this.timeEnd.bind(this);
		this.start = this.start.bind(this);
		this.stop = this.stop.bind(this);
		this.succeed = this.succeed.bind(this);
		this.fail = this.fail.bind(this);
		this.update = this.update.bind(this);
	}

	/* ================= INTERNAL ================= */

	private parseError(err: Error) {
		const stack = err.stack?.split('\n') || [];
		const line = stack.find((l) => l.trim().startsWith('at '))?.trim() || stack[1]?.trim() || '';

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

	/**
	 * Creates a child {@link Terminal} logger inheriting this instance's configuration and shared spinner.
	 * @param options - Overrides for scope, tag, icon, format, or level.
	 */
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

			// Share the parent's spinner instance across child loggers
			_spinnerInstance: this.spinner,

			...options,
		});
	}

	/**
	 * Clears the terminal screen.
	 */
	public clear() {
		const wasSpinning = this.spinEnabled && this.spinner.isSpinning;
		if (wasSpinning) this.spinner.stop();
		console.clear();
		if (wasSpinning) this.spinner.start();
	}

	/**
	 * Renders a styled magenta box banner in the terminal.
	 * @param text - Banner text (defaults to `this.title`).
	 * @param options - Additional `boxen` styling options.
	 */
	public box(text?: string, options?: Options) {
		const wasSpinning = this.spinEnabled && this.spinner.isSpinning;
		if (wasSpinning) this.spinner.stop();

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

		if (wasSpinning) this.spinner.start();
	}

	/**
	 * Logs an informational message with the configured prefix.
	 * @param args - Values or messages to format and print.
	 */
	public log<T>(...args: T[]): void {
		this.writeLine('info', this.formatMessage(args));
	}

	/**
	 * Alias for {@link Terminal.log} — logs an informational message.
	 * @param args - Values or messages to format and print.
	 */
	public info<T>(...args: T[]): void {
		this.writeLine('info', this.formatMessage(args));
	}

	/**
	 * Logs a warning message with a yellow warning indicator.
	 * @param args - Values or messages to format and print.
	 */
	public warn<T>(...args: T[]): void {
		this.writeLine('warn', this.formatMessage(args));
	}

	/**
	 * Logs an error message or `Error` instance (extracting file, line, and column from the stack trace).
	 * @param args - Error objects or messages to format and print.
	 */
	public error(...args: any[]): void {
		const formatted = args.map((arg) => {
			if (typeof arg === 'string') return arg;

			if (!(arg instanceof Error)) {
				return util.inspect(arg, { colors: true, depth: 2 });
			}

			const parsed = this.parseError(arg);
			return chalk.red.bold(`${parsed.message} (${parsed.filepath}:${parsed.line}:${parsed.column})`);
		});

		this.writeLine('fail', `${this.prefix()} | ${formatted.join(' ')}`);
	}

	/**
	 * Logs a debug message when `this.level === 'DEBUG'`.
	 * @param args - Values or messages to format and print.
	 */
	public debug<T>(...args: T[]): void {
		if (this.level === 'DEBUG') {
			this.writeLine('info', this.formatMessage(args));
		}
	}

	/**
	 * Prints tabular data using `console.table`.
	 * @param data - Array or object of tabular data to display.
	 */
	public table(data: any[]) {
		const wasSpinning = this.spinEnabled && this.spinner.isSpinning;
		if (wasSpinning) this.spinner.stop();
		console.table(data);
		if (wasSpinning) this.spinner.start();
	}

	private timers = new Map<string, number>();

	/**
	 * Starts a named timer for measuring execution duration.
	 * @param label - Unique label identifying the timer.
	 */
	public time(label: string) {
		this.timers.set(label, Date.now());
	}

	/**
	 * Ends a previously started timer and logs the elapsed duration in milliseconds.
	 * @param label - Label passed to {@link Terminal.time}.
	 */
	public timeEnd(label: string) {
		const start = this.timers.get(label);
		if (!start) return;

		const duration = Date.now() - start;
		this.info(`${label} took ${duration}ms`);
		this.timers.delete(label);
	}

	/* ================= OPTIONAL CONTROL ================= */

	/**
	 * Starts or updates the active spinner text with the current prefix.
	 * @param text - Optional status text to display next to the spinner.
	 */
	public start(text?: string): void {
		if (!this.spinEnabled) return;
		this.spinner.start(text ? `${this.prefix()} | ${text}` : '');
	}

	/**
	 * Stops and clears the active spinner.
	 */
	public stop(): void {
		if (!this.spinEnabled) return;
		this.spinner.stop();
	}

	/**
	 * Persists a green success (`✔`) line and stops the spinner.
	 * @param text - Optional completion message.
	 */
	public succeed(text?: string): void {
		if (!this.spinEnabled) return;
		this.spinner.succeed(`${this.prefix()} | ${text || ''}`);
	}

	/**
	 * Persists a red failure (`✖`) line and stops the spinner.
	 * @param text - Optional failure message.
	 */
	public fail(text?: string): void {
		if (!this.spinEnabled) return;
		this.spinner.fail(`${this.prefix()} | ${text || ''}`);
	}

	/**
	 * Checks all installed `@xernerx/*` and `xernerx` packages in the current project against the npm registry
	 * and logs a single unified, readable list of available updates with direct documentation and changelog links.
	 *
	 * Multiple calls across different packages during startup are automatically batched into a single check
	 * so the terminal is never spammed with duplicate update notices.
	 *
	 * @param pkg - Optional package descriptor (`{ name, version }`) or package name/registry URL to include in the check.
	 */
	public async update(pkg?: UpdatePackageInput | string): Promise<void> {
		if (typeof pkg === 'string' && pkg.trim()) {
			const cleanName = pkg
				.trim()
				.replace(/^https?:\/\/registry\.npmjs\.org\//, '')
				.replace(/\/+$/, '');
			if (cleanName === 'xernerx' || cleanName.startsWith('@xernerx/')) {
				if (!registeredUpdatePackages.has(cleanName)) {
					registeredUpdatePackages.set(cleanName, undefined);
				}
			}
		} else if (pkg && typeof pkg === 'object' && pkg.name) {
			if (pkg.name === 'xernerx' || pkg.name.startsWith('@xernerx/')) {
				registeredUpdatePackages.set(pkg.name, pkg.version);
			}
		}

		if (activeUpdateCheck) {
			return activeUpdateCheck;
		}

		activeUpdateCheck = (async () => {
			// Wait briefly so any concurrent startup calls from other @xernerx/* packages register into the same batch
			await new Promise((resolve) => setTimeout(resolve, 50));

			try {
				const cwd = process.cwd();
				const projectPkgPath = path.resolve(cwd, 'package.json');
				const declaredRanges = new Map<string, string>();

				if (fs.existsSync(projectPkgPath)) {
					try {
						const projectPkg = JSON.parse(fs.readFileSync(projectPkgPath, 'utf8'));
						const allDeps: Record<string, string> = {
							...(projectPkg.dependencies || {}),
							...(projectPkg.devDependencies || {}),
						};

						for (const [depName, range] of Object.entries(allDeps)) {
							if ((depName === 'xernerx' || depName.startsWith('@xernerx/')) && typeof range === 'string') {
								declaredRanges.set(depName, range);
								if (!registeredUpdatePackages.has(depName)) {
									registeredUpdatePackages.set(depName, undefined);
								}
							}
						}

						if (typeof projectPkg.name === 'string' && (projectPkg.name === 'xernerx' || projectPkg.name.startsWith('@xernerx/')) && typeof projectPkg.version === 'string') {
							registeredUpdatePackages.set(projectPkg.name, projectPkg.version);
						}
					} catch {
						// Ignore malformed project package.json
					}
				}

				const packagesToCheck = Array.from(registeredUpdatePackages.keys()).sort((a, b) => a.localeCompare(b));
				if (packagesToCheck.length === 0) return;

				const resolveInstalledVersion = (pkgName: string): string | undefined => {
					const nodeModulesPkgPath = path.resolve(cwd, 'node_modules', ...pkgName.split('/'), 'package.json');
					if (fs.existsSync(nodeModulesPkgPath)) {
						try {
							const installed = JSON.parse(fs.readFileSync(nodeModulesPkgPath, 'utf8'));
							if (typeof installed.version === 'string' && installed.version.trim()) {
								return installed.version.trim();
							}
						} catch {
							// Fallback below
						}
					}

					const registeredVersion = registeredUpdatePackages.get(pkgName);
					if (registeredVersion) return registeredVersion;

					const declared = declaredRanges.get(pkgName);
					if (declared && !declared.startsWith('workspace:') && !declared.startsWith('link:') && !declared.startsWith('file:')) {
						return declared.replace(/^[\^~>=<\s]+/, '');
					}

					return undefined;
				};

				interface OutdatedEntry {
					name: string;
					current: string;
					latest: string;
					type: 'major' | 'minor' | 'patch' | 'beta';
				}

				const results = await Promise.all(
					packagesToCheck.map(async (pkgName): Promise<OutdatedEntry | null> => {
						const current = resolveInstalledVersion(pkgName);
						if (!current) return null;

						const registryData = (await fetch(`https://registry.npmjs.org/${pkgName}`)
							.then((res) => (res.ok ? res.json() : null))
							.catch(() => null)) as { 'dist-tags'?: { latest?: string; beta?: string } } | null;

						const distTags = registryData?.['dist-tags'];
						if (!distTags) return null;

						const range = declaredRanges.get(pkgName) || '';
						const wantsBeta = range.includes('beta') || current.includes('beta');

						if (wantsBeta) {
							const latestBeta = distTags.beta;
							if (latestBeta && latestBeta !== current) {
								return { name: pkgName, current, latest: latestBeta, type: 'beta' };
							}
							return null;
						}

						const latest = distTags.latest;
						if (!latest || latest === current) return null;

						const [latestMajor = 0, latestMinor = 0, latestPatch = 0] = latest
							.split('-')[0]
							.split('.')
							.map((n) => Number.parseInt(n, 10));
						const [currMajor = 0, currMinor = 0, currPatch = 0] = current
							.split('-')[0]
							.split('.')
							.map((n) => Number.parseInt(n, 10));

						if (latestMajor > currMajor) {
							return { name: pkgName, current, latest, type: 'major' };
						}
						if (latestMajor === currMajor && latestMinor > currMinor) {
							return { name: pkgName, current, latest, type: 'minor' };
						}
						if (latestMajor === currMajor && latestMinor === currMinor && latestPatch > currPatch) {
							return { name: pkgName, current, latest, type: 'patch' };
						}

						return null;
					})
				);

				const outdated = results.filter((entry): entry is OutdatedEntry => entry !== null);
				if (outdated.length === 0) return;

				const maxNameLen = Math.max(...outdated.map((o) => o.name.length));
				const header =
					outdated.length === 1 ? `Update available for ${chalk.magenta.bold(outdated[0].name)}:` : `Updates available for ${chalk.magenta.bold(String(outdated.length))} Xernerx packages:`;

				const lines = [header];

				for (const item of outdated) {
					const paddedName = item.name.padEnd(maxNameLen, ' ');
					const badge =
						item.type === 'major' ? chalk.red.bold('major') : item.type === 'minor' ? chalk.yellow.bold('minor') : item.type === 'beta' ? chalk.magenta.bold('beta') : chalk.green.bold('patch');
					const docsUrl = `https://docs.xernerx.com/packages/${item.name}`;
					const changelogUrl = `https://info.xernerx.com/changelog#${item.name}`;

					lines.push(
						`  • ${chalk.cyan.bold(paddedName)}  ${chalk.dim(item.current)} → ${chalk.green.bold(item.latest)} (${badge})`,
						`    ${chalk.dim('Docs:')} ${chalk.underline(docsUrl)} ${chalk.dim('|')} ${chalk.dim('Changelog:')} ${chalk.underline(changelogUrl)}`
					);
				}

				const installTargets = outdated.map((o) => `${o.name}@${o.latest}`).join(' ');
				lines.push(`Run ${chalk.cyan.bold(`'npm install ${installTargets}'`)} to update.`);

				this.info(lines.join('\n'));
			} catch {
				// Never crash the host application if offline or npm registry is unreachable
			}
		})();

		return activeUpdateCheck;
	}
}

/**
 * Default singleton {@link Terminal} instance.
 */
export const terminal = new Terminal();
