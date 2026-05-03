/** @format */

import { terminal } from '../dist/main.mjs';
import './file.mjs';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
	terminal.box();

	await wait(1000);

	terminal.log('wait 1 second');

	await wait(5000);

	terminal.error('this is an error');

	terminal.warn('this is a warning');

	terminal.error(new Error('test'));
})();
