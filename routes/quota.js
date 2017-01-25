
var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var path = require('path');
var http = require('http');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

router.get('/quota/:user/:id', function(req, res) {
    /*
    "quota": {
        "home": {
            "protocol": "http",
            "port": 8086,
            "hostname": "gomngr",
            "db": "goacct",
            "series": "goacct.fixed.disk.home.user.#USER#"
        },
        "omaha": {
            "protocol": "http",
            "port": 8086,
            "hostname": "gomngr",
            "db": "goacct",
            "series": "goacct.fixed.disk.panasas-omaha.user.#USER#"
        }
        curl "http://localhost:8086/query?db=goacct&q=SELECT%20last(%22value%22)%20FROM%20%22goacct.fixed.disk.home.user.osallou%22"
        {"results":[{"series":[{"name":"goacct.fixed.disk.home.user.osallou","columns":["time","last"],"values":[["2017-01-25T04:00:10Z",6.737533e+06]]}]}]}

    */
    var quotas = [];
    var serie = GENERAL_CONFIG.quota[req.param('id')]['series'].replace("#USER#", req.param('user'));
    var options = {
            protocol: GENERAL_CONFIG.quota[req.param('id')]['protocol'],
            port: GENERAL_CONFIG.quota[req.param('id')]['port'],
            hostname: GENERAL_CONFIG.quota[req.param('id')]['hostname'],
            method: 'CONNECT',
            path: '/query?db=' + GENERAL_CONFIG.quota[req.param('id')]['db'] + "&q=SELECT%20last(%22value%22)%20FROM%20/" + serie + "/"
    };

    var hreq = http.request(options);
    hreq.end();
    console.log("Get stats for " + req.param('id'));
    hreq.on('connect', (res, socket, head) => {
        socket.on('data', (chunk) => {
            var points = JSON.parse(chunk.toString());
            var series = points[0]['series'];

            for(var s=0;s<series.length;s++){
                  quotas.push(series[s]['values'][0][1] / 1000000000)
            }

            res.send({'name': req.param('id'), 'value': quotas.join('/')})
            res.end();
            return
        });
        socket.on('end', () => {
        });
    });

});



module.exports = router;
