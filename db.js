//Initializes the Neo4j DB and exports the resulting neodb to the app for other scripts to use.
var neo4j = require('neo4j');
var neodb = new neo4j.GraphDatabase('http://localhost:7474');
if(neodb){console.log("Neo4j Connection Initialized.");}
module.exports.neodb = neodb;

var mongodb = require('mongodb').MongoClient;
module.exports.mongodb = mongodb;
var mongoURI = 'mongodb://localhost:27017/grnsearchtest';
module.exports.mongoURI = mongoURI

var mongodb = require('mongodb');
module.exports.initializeMongo = function (callback) {
  var server = new mongodb.Server("127.0.0.1", 27017, {});
  new mongodb.Db('grnsearchtest', server, {w: 1}).open(function (error, client) {
    module.exports.client = client;
    module.exports.userData = new mongodb.Collection(client, 'userData');
    callback(error);
  });
};