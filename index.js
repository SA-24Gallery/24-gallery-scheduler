require('dotenv').config();
const Scheduler = require('./src/Scheduler');

const scheduler = new Scheduler();

scheduler.run();
