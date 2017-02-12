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
 * query: {
 *  filter: 'hours'|'minutes' default: hours
 * }
 */
server.route({
  method: 'GET',
  path: '/api/sentiment',
  handler: function (req, reply) {
    let filter = 'hours';
    if (req.query.filter) {
      filter = req.query.filter;
    }
    // get last hours
    if (filter === 'hours') {
      const times = [];
      const currentDate = Moment().utcOffset(-8).subtract(12, 'h');

      //console.log('current', currentDate);
      times.push(currentDate.format('YYYYMMDDHH'));
      for (let i = 0; i < 12; i+=1) {
        currentDate.add(1, 'h');
        times.push(currentDate.format('YYYYMMDDHH'));
      }
      const promises = [];
      for(const time of times) {
        promises.push(client.getAsync(time)
          .then((avg) => {
            return {
              time,
              avg
            };
          })
        );
      }
      Promise.all(promises)
      .then((res) => {
        console.log(res);
        reply(res);
      });
    }
    else {
      // get the last hour
      const times = [];
      const currentDate = Moment().utcOffset(-8).subtract(60, 'm');

      times.push(currentDate.format('YYYYMMDDHHmm'));
      for (let i = 0; i < 60; i+=1) {
        currentDate.add(1, 'm');
        times.push(currentDate.format('YYYYMMDDHHmm'));
      }
      const promises = [];
      for(const time of times) {
        promises.push(client.getAsync(time)
          .then((avg) => {
            return {
              time,
              avg
            };
          })
        );
      }
      Promise.all(promises)
      .then((res) => {
        reply(res);
      });
    }
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
  path: '/api/sentiment',
  handler: function (req, reply) {
    const redKey = Moment().utcOffset(-8).format('YYYYMMDDHH')
    const redKeyMin = Moment().utcOffset(-8).format('YYYYMMDDHHmm')
    let minAverage, hourAverage, minuteCount, hourCount;
    const promises = [];

    // get averages
    promises.push(client.getAsync(redKeyMin)
    .then(function (res) {
      if (res === 'undefined') {
        res = 0;
      }
      minAverage = parseFloat(res) || 0;
    }));
    promises.push(client.getAsync(redKey)
    .then(function (res) {
      if (res === 'undefined') {
        res = 0;
      }
      hourAverage = parseFloat(res) || 0;
    }));

    // get counts
    promises.push(client.getAsync(`${redKey}.count`)
    .then(function (res) {
      if (res === 'undefined') {
        res = 0;
      }
      hourCount = parseInt(res, 10) || 0;
    }));
    promises.push(client.getAsync(`${redKeyMin}.count`)
    .then(function (res) {
      if (res === 'undefined') {
        res = 0;
      }
      minuteCount = parseInt(res) || 0;
    }));

    Promise.all(promises)
    .then(() => {
      //console.log('responses', minAverage, typeof minuteCount, hourAverage, hourCount);
      const score = parseFloat(req.payload.score || 0)
      minAverage = (score + (minAverage * minuteCount)) / (minuteCount + 1);
      hourAverage = (score + (hourAverage * hourCount)) / (hourCount + 1);
      //console.log('min average', redKeyMin, minAverage);
      client.incr(`${redKey}.count`, client.print);
      client.setAsync(`${redKey}`, hourAverage);
      client.incr(`${redKeyMin}.count`, client.print);
      return client.setAsync(`${redKeyMin}`, minAverage);
    })
    .then(() => {
      return reply({
        succes: true
      });
    })
    .catch((err) => {
      console.error(err);
      return reply({
        succes: false
      });
    });
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
