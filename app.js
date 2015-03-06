//Initialization variables for all dependencies.
var express = require('express');
var app = express();
var https = require('https');
var http = require('http');
var db = require('./db.js');
var cons = require('consolidate');
var swig = require('swig');
var async = require("async");
var port = 8080;

//Sets up templating engine for establishing directory structure.
app.engine('.html', cons.swig);
app.set('view engine', 'html')
swig.init({ encoding: 'utf-8', root: 'templates/'});
app.set('views', 'templates/');

var homepage = require('./views/homepage.js');

app.get("/",homepage.get);

//Places static files in the public folder.
app.use(express.static(__dirname + '/public'));

//Sets up the web socket and localhost server at the specified port. (8080).
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
io.sockets.on('connection', homepage.loader); 
server.listen(port);

console.log("Listening on port " + port);