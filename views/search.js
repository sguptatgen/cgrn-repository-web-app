var db = require('./../db'), async = require("async"), csvdata = [];
var path = require('path');
var color = [["1", "61515", "61605", "92180", "93582", "97166", "100534"],["STATE_CHANGE", "CO_CONTROL", "SEQUENTIAL_CATALYSIS", "COMPONENT_OF", "IN_SAME_COMPONENT", "REACTS_WITH", "METABOLIC_CATALYSIS", "GENERIC_OF", "UPREGULATE_EXPRESSION", "DOWNREGULATE_EXPRESSION", "INTERACTS_WITH", "adjacent", "influences"]];

module.exports.get = function(req,res){
	if (req.session.user) res.sendFile(path.join(__dirname, '../templates', 'search.html'));
	else res.redirect('/');
}
module.exports.loader = function(socket){
	var executeQuery = function(data){
		if(data.queryoptions.algorithm === "shortest"){
			function getShortestPaths(){
				var depth = 1, params = {}; 
				var paramsbuilder = function () {
					params.startnode = parseInt(data.querygenes[0]);
					params.endnode = parseInt(data.querygenes[data.querygenes.length-1]);
					params.midnodes = [];
					for(i=1; i<data.querygenes.length-1; i++){params.midnodes.push(parseInt(data.querygenes[i]));}
				}
				paramsbuilder();
				var query = function () {
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
					queryaddons[3] = data.queryoptions.pathwaynum-csvdata.length;
					var buildquery = ["START startnode=node({startnode}), endnode=node({endnode})", 'MATCH p=(startnode)' + queryaddons[0] + '-[' + queryaddons[1] + ']->(endnode)', queryaddons[2], 'RETURN p', 'LIMIT ' + queryaddons[3] + ''].join('\n'); console.log(buildquery); return buildquery;
				}
				var cb = function (err, results) {
					if (err) {console.log("Error with query", err); socket.emit('queryerror',{error: err});}
					else {
						var iterationentries = results.length, loopcounter = 0;
						async.mapSeries(results, function (result,cb1) { 
							async.mapSeries(result['p']['relationships'],function (relationship, cb2) { 
								db.neodb.getRelationshipById(relationship.id, function (err,relationship) { 
									if (err) {console.log("Error finding the relationship", err);}
									db.neodb.getNodeById(relationship.start.id, function (err,startnode) {
										if (err) {console.log("Error finding the start node", err);}
										db.neodb.getNodeById(relationship.end.id, function (err,endnode) {
											console.log(JSON.stringify(endnode.data));
											if (err) {console.log("Error finding the end node", err);}
											var innerarr = [startnode.data.name, endnode.data.name, startnode.id, endnode.id, startnode.data.graphid, endnode.data.graphid, relationship.id, color[1].indexOf(relationship.type), relationship.type, color[0].indexOf(startnode.data.graphid.toString())];
											cb2(null,innerarr);
										});
									});
								});
							}, function (err,res) {
								loopcounter++;
								csvdata.push(res); 
								if(csvdata.length !== parseInt(data.queryoptions.pathwaynum) && iterationentries === loopcounter){depth++; socket.emit('queryresults',{csv:csvdata}, ''); db.neodb.query(query(),params,cb);} 
								else if (csvdata.length === parseInt(data.queryoptions.pathwaynum)) {console.log("CSV", csvdata, csvdata.length); socket.emit('queryresults',{csv:csvdata, noderequests:data.querygenes}); csvdata.length = 0;}
							});
							cb1();
						},function (err, results) {if(!iterationentries){depth++; db.neodb.query(query(),params,cb);}});
					}
				};
				db.neodb.query(query(),params,cb);
			}
			getShortestPaths();
		}
	}
	socket.on('queryrequest', function (data){
		var index = 0;
		console.time("process");
		async.eachSeries(data.querygenes,function (item,cb0){
			db.neodb.query(["MATCH (n:gene{name:{n}})","RETURN n"].join('\n'),{n: item},function(err,results){
				data.querygenes[data.querygenes.indexOf(item)] = results[0]['n'].id; 
				index++;
				cb0(err);
			});
		},function(err){if(err) {console.log(err);} else if (index === data.querygenes.length){executeQuery(data);}}); //Calls executeQuery to handle the query request.
	});
	socket.on('annotationrequest', function (data){
		//annotationsquery builds the queries for annotation requests for nodes and links.
		var annotationsquery = function(type){
			if(type === "node"){var buildquery = ['START n=node({itemid})','WITH n.UniProt! AS a, n.`NCBI Gene`! AS b','RETURN a,b;'].join('\n'); return buildquery;}
			if(type === "link"){var buildquery = ['START r=rel({itemid})','WITH r.source! AS a, r.pubmed! AS b','RETURN a,b;'].join('\n'); return buildquery;}
		}
		var annotationsparams = {itemid: data.queryitem}; //Sets parameters for the query.
		db.neodb.query(annotationsquery(data.querytype), annotationsparams, function(err, results){
			if (err) {console.log("Error with getting Annotation IDs", err);}
			else if (!results.length || (data.querytype === "node" && !results[0]['a'] && !results[0]['b']) || (data.querytype === "link" && !results[0]['a'] && !results[0]['b'])) {console.log("No Annotation IDs found"); socket.emit('annotationreturn', {'err':'noresults'});} //returns an error to the client side error handling function in the cass of no results.
			else { //Sends Annotation IDs for use by REST APIs from UniProt, NCBI Gene, and Pubmed.
				if(data.querytype === "node"){socket.emit('annotationreturn', {'UniProt':results[0]['a'], 'NCBIGene':results[0]['b'], 'err':'',});}
				else if(data.querytype === "link"){socket.emit('annotationreturn', {'source':results[0]['a'], 'pubmed':results[0]['b'], 'err':'',});}
			}
		});
	});
	socket.on('time',function(data){console.timeEnd("process");});
}