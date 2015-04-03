var sys = require('sys');
var exec = require('child_process').exec;

exec("./mongodb-3.0/bin/mongod --dbpath ./mongodb-3.0/data/db --fork --logpath ./mongodb-3.0/logs/nodetest.log", function(error, stdout, stderr){
	sys.puts(stdout);
	exec("./neo4j-2.0.4/bin/neo4j start", function(error, stdout, stderr){
		sys.puts(stdout);
		var dateString = "-" + ((new Date()).toISOString().replace(/\:/g,"-"));
		exec("forever start --uid 'production' -a /home/sgupta/.forever/production"+dateString+".log index.js", function(error, stdout, stderr){
			sys.puts(stdout);
		});
	});
});