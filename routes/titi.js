
var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var fs = require('fs');
var path = require('path');
var http = require('http');

var CONFIG = require('config');
var GENERAL_CONFIG = CONFIG.general;

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
    volume='home';
    var quotas = [];
    var serie = GENERAL_CONFIG.quota[volume]['series'].replace("#USER#", 'osallou');
    var options = {
            protocol: GENERAL_CONFIG.quota[volume]['protocol'],
            port: GENERAL_CONFIG.quota[volume]['port'],
            host: GENERAL_CONFIG.quota[volume]['hostname'],
            method: 'CONNECT',
            path: '/query?db=' + GENERAL_CONFIG.quota[volume]['db'] + "&q=SELECT%20last(%22value%22)%20FROM%20/" + serie + "/"
    };
    http.get({
     host: 'gomngr',
     port: '8086',
     path: '/query?db=' + GENERAL_CONFIG.quota[volume]['db'] + "&q=SELECT%20last(%22value%22)%20FROM%20/" + serie + "/"
    }, function(response){

        var body = '';
        response.on('data', function(d) {
            body += d;
        });
        response.on('end', function() {

            // Data reception is done, do whatever with it!
            var parsed = JSON.parse(body);
            console.log(parsed.results[0].series);
        });
    });
    /*
    var hreq = http.request(options);
    hreq.on('error', function(err) { console.log("ERROR: "+err);});
    hreq.end();
    console.log("Get stats for " + volume);
    hreq.on('connect', function(res, socket, head) {
        socket.on('data', function(chunk) {
            console.log("##RECEVIED "+chunk);
            var points = JSON.parse(chunk.toString());
            var series = points[0]['series'];

            for(var s=0;s<series.length;s++){
                  quotas.push(series[s]['values'][0][1] / 1000000000)
            }

            console.log({'name': req.param('id'), 'value': quotas.join('/')})
        });
        socket.on('end', function() {
        });
    });
     */
