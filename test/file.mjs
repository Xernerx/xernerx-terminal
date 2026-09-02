/** @format */

import { terminal } from '../dist/main.js';

terminal.clear();

const child = terminal.child({ scope: 'LOGGER' });

child.log('This is a log message');
