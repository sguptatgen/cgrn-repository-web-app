//Initialization variables for all dependencies.
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var bodyParser = require('body-parser');
var fs = require('fs');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var port = 8080;
var db = require("./db.js");

//Sets up templating engine for establishing directory structure
app.set('port', port);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(session({secret: '1234567890QWERTY', resave: false, saveUninitialized: false}));
app.use(express.static(__dirname + '/public'));
db.initializeMongo(function (err) {
	if (err) throw err;
	console.log("Successfully connected to MongoDB.");
	var loginpage = require('./views/loginpage.js');
	//var search = require('./views/search.js');
	var shortestpath = require('./views/shortestpath.js');
	//var genesetgraph = require('./views/genesetgraph.js');
	app.get('/', loginpage.get);
	app.post('/', loginpage.post);
	//app.get('/search', search.get);
	app.get('/shortestpath', shortestpath.get);
	//app.get('/genesetgraph', genesetgraph.get);
	io.on('connection', shortestpath.loader);

	http.listen(app.get('port'), function(){
		console.log('listening on:' + app.get('port'));
	});
});