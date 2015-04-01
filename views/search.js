var db = require('./../db'), async = require("async"), path = require('path');

module.exports.get = function(req,res){
	if (req.session.user) res.sendFile(path.join(__dirname, '../templates', 'search.html'));
	else res.redirect('/');
}
module.exports.loader = function(socket) {
	var executeQuery = function(data) {
		var getShortestPaths = function() {
			var depth = 1, numPathsRetrived=0; 
			var buildParams = function () {
				var params = {}
				params.startnode = data.geneParams[0];
				params.endnode = data.geneParams[data.geneParams.length-1];
				params.midnodes = [];
				for(i=1; i<data.geneParams.length-1; i++){params.midnodes.push(data.geneParams[i]);}
				return params;
			};
			var buildQuery = function () {
				var queryAddons = ['','','','']; 
				//if (data.optionParams.reltypes !== "ALL") {queryAddons[1] = ":" + data.optionParams.reltypes;}
				for(i=0; i<depth-1; i++){queryAddons[0] += '-[' + queryAddons[1] + ']->()';}
				if(data.optionParams.graphs.length /*|| data.optionParams.cycles === "false"*/ || params.midnodes.length){
					queryAddons[2] = []; queryAddons[3] = [];
					for(j=0; j<params.midnodes.length; j++){queryAddons[2].push('ANY(n in nodes(p) WHERE id(n) = ' + params.midnodes[j] + ')');}
					//if(data.optionParams.cycles === "false") {queryAddons[2].push("ALL(n in nodes(p) WHERE 1=length(filter(m in nodes(p) : m=n)))");}
					for(k=0; k<data.optionParams.graphs.length; k++){queryAddons[3].push(data.optionParams.graphs[k]);}
					if(data.optionParams.graphs.length){queryAddons[2].push('ALL(n in nodes(p) WHERE n.graphid IN [' + queryAddons[3].join(',') + '])');}	
					queryAddons[2] = 'WHERE ' + queryAddons[2].join(' AND ');
				}
				queryAddons[3] = data.optionParams.numPaths-numPathsRetrived;
				var queryString = ["START startnode=node({startnode}), endnode=node({endnode})", 'MATCH p=(startnode)' + queryAddons[0] + '-[' + queryAddons[1] + ']->(endnode)', queryAddons[2], 'RETURN p', 'LIMIT ' + queryAddons[3] + ''].join('\n'); 
				console.log(queryString); 
				return queryString;
			}
			var queryCallback = function (err, pathways) {
				if (err) throw err;
				else if (!pathways || !pathways.length) {
					depth++;
					db.neodb.query(buildQuery(),params,queryCallback);
				}
				else {
					async.mapSeries(pathways, function (pathway,cb1) { 
						async.mapSeries(pathway['p']['relationships'],function (relationship, cb2) { 
							db.neodb.getRelationshipById(relationship.id, function (err,rel) { 
								if (err) throw err;
								db.neodb.getNodeById(rel.start.id, function (err,startnode) {
									if (err) throw err;
									db.neodb.getNodeById(rel.end.id, function (err,endnode) {
										cb2(err,[rel,startnode,endnode]);
									});
								});
							});
						}, cb1);
					}, function (err, resultingPathways) {
						numPathsRetrived += resultingPathways.length;
						prunePathwayData(resultingPathways,function(err,prunedPathways){
							console.log("Sending " + prunedPathways.length + " pathways to the user.");
							if (numPathsRetrived < parseInt(data.optionParams.numPaths)) {
								depth++;
								db.neodb.query(buildQuery(),params,queryCallback);
							}
							else if (numPathsRetrived >= parseInt(data.optionParams.numPaths)) {
								console.log("Query completed!");
							}
							socket.emit('queryResults',{"results":prunedPathways, "nodeRequests":data.geneParams});
						});
						
					});
				}
			};
			var prunePathwayData = function(pathways, callback){
				async.mapSeries(pathways,function(pathway,cb1){
					async.mapSeries(pathway,function(relationship,cb2){
						var rel = relationship[0]["_data"]["data"];
						rel.relType = relationship[0]["_data"]["type"];
						rel.id = relationship[0].id;
						var start = relationship[1]["_data"]["data"];
						start.id = relationship[1].id;
						var end = relationship[2]["_data"]["data"];
						end.id = relationship[2].id;
						cb2(null,{"rel":rel,"start":start,"end":end});
					}, cb1);
				}, function(err,prunedPathways){
					callback(err, prunedPathways);
				});
			}
			var params = buildParams();
			db.neodb.query(buildQuery(), params, queryCallback);
		};
		getShortestPaths();
	}
	socket.on('queryRequest', function (data){
		console.time("process");
		async.mapSeries(data.geneParams,function (geneName,callback){
			db.neodb.query(["MATCH (n:gene{name:{geneName}})","RETURN n"].join('\n'),{'geneName': geneName}, function(err,geneNodes){
				if (err) throw err;
				else if (geneNodes.length) {
					callback(err,geneNodes[0]['n'].id);
				}
			});
		},function(err, results){
			if (err) throw err; 
			else {
				console.log("User requested nodes with IDs: " + results); 
				data.geneParams = results;
				executeQuery(data);
			}
		});
	});
	socket.on('time',function(data){console.timeEnd("process");});
}