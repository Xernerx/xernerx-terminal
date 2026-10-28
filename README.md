<!-- @format -->

![Xernerx Banner](https://xernerx.com/banner.png)

# @xernerx/terminal

Formatted CLI logger and interactive TTY spinner (`Terminal` & `Spinner`) for Xernerx Studios packages, Discord bots, and backend services.

---

## Features

- **Class-Based `Terminal` Logger**: Extend `Terminal` (or instantiate `new Terminal()`) with customizable prefix tokens (`title`, `scope`, `tag`, `time`, `memory`, `duration`, `uptime`, `pid`, `requestId`, and more).
- **Interactive TTY-Aware `Spinner`**: Non-blocking terminal spinner that automatically pauses and resumes around `.log()`, `.info()`, `.warn()`, `.error()`, `.table()`, and `.box()` calls.
- **Scoped Child Loggers (`this.child()`)**: Create module-scoped loggers (`XF`, `XC`, `XS`, `XH`, `XT`, `XW`) that share the parent spinner instance without visual tearing.
- **Rich Diagnostic Formatting**: Automatic `Error` stack trace parsing (`filepath:line:column`), `boxen` banner boxes (`this.box()`), tabular output (`this.table()`), and execution timers (`this.time()` / `this.timeEnd()`).
- **Zero-Configuration Singleton**: Exports a pre-configured `terminal` singleton alongside the `Terminal` and `Spinner` classes.

---

## Install

```bash
pnpm add @xernerx/terminal
```

```bash
npm install @xernerx/terminal
```

---

## Setup

Extend `Terminal` to log formatted messages, banners, timers, and spinners:

```ts
import { Terminal } from '@xernerx/terminal';

export class Logger extends Terminal {
	constructor() {
		super({
			title: 'XERNERX',
			scope: 'XT',
			tag: 'Main',
		});

		this.box('XERNERX BOT');
		this.info('Starting bot services...');
		this.log('Connected to primary cluster');
		this.warn('Slow query detected (320ms)');
		this.error(new Error('Connection reset'));

		// Timing helpers
		this.time('sync');
		this.timeEnd('sync');

		// Interactive spinner control
		this.start('Deploying application commands...');
		this.succeed('Application commands deployed');
	}
}

new Logger();
```

---

## Standalone Spinner (`Spinner`)

Extend `Spinner` to manage custom CLI progress indicators:

```ts
import { Spinner } from '@xernerx/terminal';

export class BuildSpinner extends Spinner {
	constructor() {
		super({
			text: 'Compiling TypeScript bundles...',
		});

		this.start();
		this.succeed('Build complete!');
	}
}

new BuildSpinner();
```

---

## Configuration (`TerminalOptions`)

| Option        | Type                 | Default                                                      | Description                                                                          |
| ------------- | -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `title`       | `string`             | `'XERNERX'`                                                  | Primary brand or service title shown in the prefix and `this.box()`.                 |
| `format`      | `Array<Format>`      | `['title', 'scope', 'time', 'memory', 'duration', 'uptime']` | Ordered prefix tokens rendered before each log line.                                 |
| `level`       | `LogLevel`           | `'INFO'`                                                     | Active log level (`'DEBUG' \| 'INFO' \| 'WARN' \| 'ERROR'`).                         |
| `scope`       | `string`             | —                                                            | Short module or package scope (e.g. `'XF'`, `'XC'`, `'XS'`, `'XH'`, `'XT'`, `'XW'`). |
| `tag`         | `string`             | —                                                            | Secondary bold label for categorizing output.                                        |
| `icon`        | `string`             | —                                                            | Optional emoji or symbol rendered in the prefix.                                     |
| `requestId`   | `string`             | —                                                            | Optional correlation/request ID shown when `'requestId'` is enabled.                 |
| `spin`        | `boolean`            | `true`                                                       | Enables or disables the interactive TTY spinner.                                     |
| `spinner`     | `string \| string[]` | Braille dots                                                 | Custom animation frame characters for the spinner.                                   |
| `spinnerText` | `string`             | `''`                                                         | Default idle text displayed next to the active spinner.                              |

### Supported `Format` Tokens

`'title' | 'date' | 'time' | 'datetime' | 'relative' | 'duration' | 'level' | 'env' | 'pid' | 'memory' | 'uptime' | 'scope' | 'tag' | 'icon' | 'requestId'`

---

## Methods

### `Terminal`

| Method                                     | Description                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------- |
| `this.child(options)`                      | Creates a scoped child `Terminal` sharing the parent spinner instance.           |
| `this.log(...args)` / `this.info(...args)` | Logs an informational message (`ℹ`).                                             |
| `this.warn(...args)`                       | Logs a warning message (`⚠`).                                                    |
| `this.error(...args)`                      | Logs an error message or `Error` with parsed stack `filepath:line:column` (`✖`). |
| `this.debug(...args)`                      | Logs a debug message when `level === 'DEBUG'`.                                   |
| `this.box(text?, options?)`                | Renders a rounded magenta banner box using `boxen`.                              |
| `this.table(data)`                         | Prints tabular data while cleanly pausing and resuming the active spinner.       |
| `this.time(label)` / `this.timeEnd(label)` | Measures and logs elapsed time in milliseconds.                                  |
| `this.clear()`                             | Clears the terminal screen safely around the active spinner.                     |
| `this.start(text?)` / `this.stop()`        | Starts, updates, or stops the interactive spinner.                               |
| `this.succeed(text?)` / `this.fail(text?)` | Persists a green success (`✔`) or red failure (`✖`) line and stops the spinner.  |

### `Spinner`

| Method                | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `this.start(text?)`   | Starts the spinner interval and optionally updates `this.text`.  |
| `this.stop()`         | Stops the spinner interval and clears the current terminal line. |
| `this.clear()`        | Clears the active spinner line in TTY environments.              |
| `this.succeed(text?)` | Stops the spinner and persists a green `✔` line.                 |
| `this.fail(text?)`    | Stops the spinner and persists a red `✖` line.                   |
| `this.info(text?)`    | Stops the spinner and persists a blue `ℹ` line.                  |
| `this.warn(text?)`    | Stops the spinner and persists a yellow `⚠` line.                |

---

## Documentation & API Reference

Full documentation and symbol references are available on the **[Xernerx Documentation](https://docs.xernerx.com)** and the **[`@xernerx/terminal` Package Reference](https://docs.xernerx.com/packages/@xernerx/terminal)**.

### Package Symbols (`@xernerx/terminal`)

- **Classes**:
  - [`Terminal`](https://docs.xernerx.com/packages/@xernerx/terminal#class-Terminal) — Formatted CLI logger and interactive terminal controller.
  - [`Spinner`](https://docs.xernerx.com/packages/@xernerx/terminal#class-Spinner) — Lightweight, TTY-aware terminal spinner.
- **Interfaces**:
  - [`TerminalOptions`](https://docs.xernerx.com/packages/@xernerx/terminal#interface-TerminalOptions) — Configuration options for `Terminal`.
  - [`SpinnerOptions`](https://docs.xernerx.com/packages/@xernerx/terminal#interface-SpinnerOptions) — Configuration options for `Spinner`.

### Ecosystem Links

- [Xernerx Documentation Home](https://docs.xernerx.com)
- [All Xernerx Packages](https://docs.xernerx.com/packages)
- [`xernerx` Collection](https://docs.xernerx.com/packages/xernerx)
- [`@xernerx/framework` Documentation](https://docs.xernerx.com/packages/@xernerx/framework)
- [`@xernerx/commands` Documentation](https://docs.xernerx.com/packages/@xernerx/commands)
- [`@xernerx/hooks` Documentation](https://docs.xernerx.com/packages/@xernerx/hooks)
- [`@xernerx/stats` Documentation](https://docs.xernerx.com/packages/@xernerx/stats)
- [`@xernerx/websocket` Documentation](https://docs.xernerx.com/packages/@xernerx/websocket)
- [Release Changelog](https://info.xernerx.com/changelog#@xernerx/terminal)

---

## Support & Links

- [Discord Support Server](https://xernerx.com/discord)
- [`@xernerx/terminal` Package Documentation](https://docs.xernerx.com/packages/@xernerx/terminal)
- [Xernerx Developer Portal](https://portal.xernerx.com)
- [Xernerx Website](https://xernerx.com)
