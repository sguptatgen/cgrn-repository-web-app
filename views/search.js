var db = require('./../db'), async = require("async"), path = require('path');

module.exports.get = function(req,res){
	if (req.session.user) res.sendFile(path.join(__dirname, '../templates', 'search.html'));
	else res.redirect('/');
}
module.exports.loader = function(socket) {
	var executeQuery = function(data) {
		if (data.queryoptions.algorithm === "shortest") {
			var getShortestPaths = function() {
				var depth = 1, numPathsRetrived=0; 
				var buildParams = function () {
					var params = {}
					params.startnode = data.querygenes[0];
					params.endnode = data.querygenes[data.querygenes.length-1];
					params.midnodes = [];
					for(i=1; i<data.querygenes.length-1; i++){params.midnodes.push(data.querygenes[i]);}
					return params;
				};
				var buildQuery = function () {
					var queryaddons = ['','','','']; 
					if (data.queryoptions.reltypes !== "ALL") {queryaddons[1] = ":" + data.queryoptions.reltypes;}
					for(i=0; i<depth-1; i++){queryaddons[0] += '-[' + queryaddons[1] + ']->()';}
					if(data.queryoptions.graphs.length || data.queryoptions.cycles === "false" || params.midnodes.length){
						queryaddons[2] = []; queryaddons[3] = [];
						for(j=0; j<params.midnodes.length; j++){queryaddons[2].push('ANY(n in nodes(p) WHERE id(n) = ' + params.midnodes[j] + ')');}
						if(data.queryoptions.cycles === "false") {queryaddons[2].push("ALL(n in nodes(p) WHERE 1=length(filter(m in nodes(p) : m=n)))");}
						for(k=0; k<data.queryoptions.graphs.length; k++){queryaddons[3].push(data.queryoptions.graphs[k]);}
						if(data.queryoptions.graphs.length){queryaddons[2].push('ALL(n in nodes(p) WHERE n.graphid! IN [' + queryaddons[3].join(',') + '])');}	
						queryaddons[2] = 'WHERE ' + queryaddons[2].join(' AND ');
					}
					queryaddons[3] = data.queryoptions.pathwaynum-numPathsRetrived;
					var queryString = ["START startnode=node({startnode}), endnode=node({endnode})", 'MATCH p=(startnode)' + queryaddons[0] + '-[' + queryaddons[1] + ']->(endnode)', queryaddons[2], 'RETURN p', 'LIMIT ' + queryaddons[3] + ''].join('\n'); 
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
							numPathsRetrived += resultingPathways;
							prunePathwayData(resultingPathways,function(err,prunedPathways){
								console.log(JSON.stringify(prunedPathways));
								if (numPathsRetrived <  parseInt(data.queryoptions.pathwaynum)) {
									depth++;
									db.neodb.query(buildQuery(),params,queryCallback);
								}
								else {
									socket.emit('queryResults',{"results":prunedPathways});
								}
							});
							
						});
					}
				};
				var prunePathwayData = function(pathways, callback){
					async.mapSeries(pathways,function(pathway,cb1){
						async.mapSeries(pathway,function(relationship,cb2){
							var rel = relationship[0]["_data"]["data"];
							rel.relType = relationship[0]["_data"]["type"];
							var start = relationship[1]["_data"]["data"];
							var end = relationship[2]["_data"]["data"];
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
	}
	socket.on('queryRequest', function (data){
		console.time("process");
		async.mapSeries(data.querygenes,function (geneName,callback){
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
				data.querygenes = results;
				executeQuery(data);
			}
		});
	});
	socket.on('time',function(data){console.timeEnd("process");});
}