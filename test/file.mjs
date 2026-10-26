/** @format */

import { terminal } from '../dist/main.js';

terminal.clear();

const child = terminal.child({ scope: 'XT' });

child.log('This is a log message');
