/** @format */

import { terminal } from '../dist/main.mjs';

terminal.clear();

const child = terminal.child({ scope: 'LOGGER' });

child.log('This is a log message');
