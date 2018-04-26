var assert = require('assert'),
    sinon = require('sinon'),
    log = console.log,
    GossipGirl = require('../backends/gossip_girl'),
    EventEmitter = require('events').EventEmitter;


var BufferingRepeaterServer = function(config) {
  this.config = Object.assign(
    {
      gossip_girl: [{ host: '127.0.0.1', port: 9125 }]
    },
    config
  );

  this.emitter = new EventEmitter();
};

BufferingRepeaterServer.prototype.start = function() {
  this.repeater = GossipGirl;
  this.repeater.init(0, this.config, this.emitter);
};

BufferingRepeaterServer.prototype.flush = function(metrics) {
  this.emitter.emit('flush', Date.now, metrics);
};

BufferingRepeaterServer.prototype.stop = function() {
  this.repeater.stop(function() {});
};


var mockedSocket = {
  send: sinon.spy(),
  close: function() {}
};

sinon.stub(require('dgram'), 'createSocket').returns(mockedSocket);

packetsFlushed = function() {
  return mockedSocket.send.getCalls().map(call => call.args[0].toString());
};

describe('GossipGirl', function() {
  beforeEach(function() {
    this.repeaters = {
      default: new BufferingRepeaterServer({}),
      batched: new BufferingRepeaterServer({
        flushInBatches: true,
        flushMaxSize: 64
      })
    }

    for (repeater in this.repeaters) {
      this.repeaters[repeater].start();
    }
  });

  afterEach(function() {
    for (repeater in this.repeaters) {
      this.repeaters[repeater].stop();
    }

    mockedSocket.send.reset();
  });

  it('flushes packets one by one with default configuration', function() {
    this.repeaters.default.flush({
      counters: {
        "counter.one": 1,
        "counter.two": 2,
      },
      gauges: {
        "gauge.one": 1.23,
        "gauge.two": 2.34,
      },
      timers: {
        "timer.one": [1.2, 3.4],
        "timer.two": [2.3, 4.5],
      },
    });

    assert.deepEqual(packetsFlushed(), [
      "'counter.one':1|c",
      "'counter.two':2|c",
      "'gauge.one':1.23|g",
      "'gauge.two':2.34|g",
      "'timer.one':1.2|ms",
      "'timer.one':3.4|ms",
      "'timer.two':2.3|ms",
      "'timer.two':4.5|ms"
    ]);
  });

  it('does not flush some ignorable metrics', function() {
    this.repeaters.default.flush({
      counters: {
        "statsd.packets_received": 1,
        "statsd.bad_lines_seen": 2,
        "ok.counter": 123,
      },
      gauges: {
        "statsd.timestamp_lag": 2.34,
        "ok.gauge": 1.23,
      },
      timers: {
        "statsd.packet_process_time": [1.2],
        "ok.timer": [1.2345],
      },
    });

    assert.deepEqual(packetsFlushed(), [
      "'ok.counter':123|c",
      "'ok.gauge':1.23|g",
      "'ok.timer':1.2345|ms",
    ]);
  });

  it('flushes packets in batches when batching is enabled', function() {
    this.repeaters.batched.flush({
      counters: {
        "counter.one": 1,
        "counter.two": 2,
      },
      gauges: {
        "gauge.one": 1.23,
        "gauge.two": 2.34,
      },
      timers: {
        "timer.one": [1.2, 3.4],
        "timer.two": [2.3, 4.5],
      },
    });

    assert.deepEqual(packetsFlushed(), [
      "'counter.one':1|c\n'counter.two':2|c\n'gauge.one':1.23|g",
      "'gauge.two':2.34|g\n'timer.one':1.2|ms\n'timer.one':3.4|ms",
      "'timer.two':2.3|ms\n'timer.two':4.5|ms"
    ]);
  });
});
