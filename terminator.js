var sys = require('sys');
var exec = require('child_process').exec;

exec("forever stop production", function(error, stdout, stderr){
	sys.puts(stdout);
	exec("./neo4j-2.0.4/bin/neo4j stop", function(error, stdout, stderr){
		sys.puts(stdout);
		exec("./mongodb-3.0/bin/mongod --dbpath ./mongodb-3.0/data/db --shutdown", function(error, stdout, stderr){
			sys.puts(stdout);
		});
	});
});