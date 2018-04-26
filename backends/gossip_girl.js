var util = require('util'),
    dgram = require('dgram')

function GossipGirl(startupTime, config, emitter) {
  var self = this
  self.config = config.gossip_girl || []
  self.statsd_config = config
  self.flush_in_batches = !!config.flushInBatches // boolean
  self.flush_max_size = config.flushMaxSize || 1024 // in bytes
  self.ignorable = [ "statsd.packets_received", "statsd.bad_lines_seen", "statsd.packet_process_time", "statsd.timestamp_lag" ]
  self.sock = dgram.createSocket("udp4")

  emitter.on('flush', function(time_stamp, metrics) { self.process(time_stamp, metrics); })
}

GossipGirl.prototype.gossip = function(packet) {
  var self = this,
      buffer = new Buffer(packet),
      hosts = self.config

  for (var i = 0; i < hosts.length; i++) {
    self.sock.send(buffer, 0, buffer.length, hosts[i].port, hosts[i].host, function(err, bytes) {
      if (err) {
        console.log(err)
      }
    })
  }
}

GossipGirl.prototype.format = function (key, value, suffix) {
  return "'" + key + "':" + value + "|" + suffix
}

GossipGirl.prototype.process = function(time_stamp, metrics) {
  var self = this,
      stats,
      packet = "",
      nextMetric,
      metricValues,
      metricsSent = 0,
      packetsSent = 0

  var stats_map = {
    counters: { data: metrics.counters, suffix: "c",  name: "counter" },
    gauges:   { data: metrics.gauges,   suffix: "g",  name: "gauge" },
    timers:   { data: metrics.timers,   suffix: "ms", name: "timer" }
  }

  for (type in stats_map) {
    stats = stats_map[type]

    for (key in stats.data) {
      if (self.ignorable.indexOf(key) >= 0) continue

      if (type == 'timers') {
        metricValues = stats.data[key]
      } else {
        metricValues = [stats.data[key]]
      }

      for (var i = 0; i < metricValues.length; i++) {
        nextMetric = self.format(key, metricValues[i], stats.suffix)
        metricsSent++

        if (self.statsd_config.dumpMessages) {
          util.log ("Gossiping about " + stats.name + ": " + nextMetric)
        }

        if (self.flush_in_batches) {
          if (packet.length + 1 + nextMetric.length > self.flush_max_size) {
            self.gossip(packet)
            packet = nextMetric;
            packetsSent++
          } else {
            packet = packet.length > 0 ? packet + "\n" + nextMetric : nextMetric;
          }
        } else {
          self.gossip(nextMetric);
          packetsSent++
        }
      }
    }
  }

  if (packet.length > 0) {
    self.gossip(packet);
    packetsSent++;
  }

  if (self.statsd_config.debug) {
    util.log ("Gossiping: " + metricsSent + " stats in " + packetsSent + " packets");
  }
}

GossipGirl.prototype.stop = function(cb) {
  this.sock.close();
  cb();
};

var instance;

exports.init = function(startupTime, config, events) {
  instance = new GossipGirl(startupTime, config, events);
  return true;
};

exports.stop = function(cb) {
  if(instance) {
    instance.stop(cb);
    instance = null;
  }
};
