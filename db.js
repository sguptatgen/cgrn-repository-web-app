//Initializes the Neo4j DB and exports the resulting graphdb to the app for other scripts to use.
var neo4j = require('neo4j');
var graphdb = new neo4j.GraphDatabase('http://localhost:7474');
if(graphdb){console.log("Neo4j Connection Initialized.");}
exports.graphdb = graphdb;