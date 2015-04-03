var sys = require('sys');
var exec = require('child_process').exec;

exec("./mongodb-3.0/bin/mongod --dbpath ./mongodb-3.0/data/db --fork --logpath ./mongodb-3.0/logs/nodetest.log", function(error, stdout, stderr){
	sys.puts(stdout);
	exec("./neo4j-2.0.4/bin/neo4j start", function(error, stdout, stderr){
		sys.puts(stdout);
		exec("forever start index.js", function(error, stdout, stderr){
			sys.puts(stdout);
		});
	});
});