'use strict';

const Hapi = require('hapi');
const Inert = require('inert');
const Path = require('path');
const Redis = require('redis');
const Bluebird = require('bluebird');
const Moment = require('moment');
Bluebird.promisifyAll(Redis.RedisClient.prototype);

const client = Redis.createClient({
  host: '127.0.0.1',
  port: 6379,
  db: 0,
  password: ''
});

const server = new Hapi.Server();

server.register(Inert, () => {});

server.connection({ port: 8000, host: 'localhost' });

server.route({
    method: 'GET',
    path: '/web/{param*}',
    handler: {
        directory: {
            path: Path.join(process.cwd(), 'web'),
          listing: true
        }
    }
});

server.route({
  method: 'GET',
  path: '/',
  handler: function (req, reply) {
    reply('hello');
  }
});

/**
 *
 * payload: {
 *   sentiment: {number}
 *   value: {string}
 * }
 */
server.route({
  method: 'POST',
  path: '/sentiment',
  handler: function (req, reply) {
    const redKey = Moment().format('YYYYMMDDHH')
    const redKeyMin = Moment().format('YYYYMMDDHHmm')
    let minAverage, hourAverage, minuteCount, hourCount;
    const promises = [];

    // get averages
    promises.push(client.getAsync(redKeyMin)
    .then(function (res) {
      if (res === 'undefined') {
        res = 0;
      }
      minAverage = res || 0;
    }));
    promises.push(client.getAsync(redKey)
    .then(function (res) {
      if (res === 'undefined') {
        res = 0;
      }
      hourAverage = res || 0;
    }));

    // get counts
    promises.push(client.getAsync(`${redKey}.count`)
    .then(function (res) {
      if (res === 'undefined') {
        res = 0;
      }
      hourCount = res || 0;
    }));
    promises.push(client.getAsync(`${redKeyMin}.count`)
    .then(function (res) {
      if (res === 'undefined') {
        res = 0;
      }
      minuteCount = res || 0;
    }));

    Promise.all(promises)
    .then(() => {
      console.log('responses', minAverage, minuteCount, hourAverage, hourCount);
      console.log('sentiment', req.payload.sentiment);
      minAverage = (parseFloat(req.payload.sentiment) + (minAverage * (minuteCount))) / (minuteCount + 1);
      hourAverage = (parseFloat(req.payload.sentiment) + (hourAverage * (hourCount))) / (hourCount + 1);
      console.log('min average', minAverage);
      client.incr(`${redKey}.count`, client.print);
      client.set(`${redKey}`, hourAverage, client.print);
      client.incr(`${redKeyMin}.count`, client.print);
      client.set(`${redKeyMin}`, minAverage, client.print);
    })
    .catch((err) => {
      console.error(err);
    });
    return reply('counted');
  }
});

server.route({
  method: 'POST',
  path: '/webhooks/events',
  handler: function (req, reply) {
    reply('cool');
  }
});

server.start((err) => {

    if (err) {
        throw err;
    }
    console.log(`Server running at: ${server.info.uri}`);
});
