/*
Required Variables:

  backends:         an array of backends to load.
                    Must include either "./backends/gossip_girl" if the file was copied directly.
                    Or simply include "gossip_girl" if it was installed via npm.


  gossip_girl:      an array of hashes of the for host: and port:
                    that details other statsd servers to which the received
                    packets should be sent to.
                    e.g. [ { host: '10.10.10.10', port: 88125 },
                           { host: 'observer', port: 8125 } ]

Optional Variables:

  flushInterval:    interval (in ms) to send data to downstream statsd's

  flushInBatches:   if set to true, will batch multiple metrics into bigger packets for downstream statsd's

  flushMaxSize:     max size of one UDP packet for batched metrics.
                    Applicable only if flushInBatches=true.
                    Default: 2048.

  debug:            if set to true, will print additional debug messages

  dumpMessages:     if set to true, will print out a message on each flush

*/
{
  "backends": [
    "./backends/gossip_girl"
  ],
  "gossip_girl": [
    {
      "host": "observer.example.com",
      "port": 8125
    }
  ],
  "flushInterval": 1000,
  "flushInBatches": true,
  "flushMaxSize": 16384,
  "dumpMessages": true
}
