//Initialization variables:
var db = require('./../db'), async = require("async"), csvdata = [];
//color variable provides a map for graph colors based on graph id and relationship type.
var color = [["1", "61515", "61605", "92180", "93582", "97166", "100534"],["STATE_CHANGE", "CO_CONTROL", "SEQUENTIAL_CATALYSIS", "COMPONENT_OF", "IN_SAME_COMPONENT", "REACTS_WITH", "METABOLIC_CATALYSIS", "GENERIC_OF", "UPREGULATE_EXPRESSION", "DOWNREGULATE_EXPRESSION", "INTERACTS_WITH", "adjacent", "influences"]];

//exports.get links this script to the index.html homepage.
exports.get = function (req, res){res.render("index.html");} 
//exports.loader initializes this script on page load.
exports.loader = function(socket){
	//executeQuery executes query algorithms. Currently, 2 query algorithms are supported: shortest path and gene snapshot. The data parameter is received from the web socket event "queryrequest" and provides various query related information.
	var executeQuery = function(data){
		if(data.queryoptions.algorithm === "shortest"){
			//The data received by the getShortestPaths algorithm include the biomolecules in query, algorithm used, cycles allowed or disallowed, graphs to traverse, number of pathways to retreive, and allowed relationship types.
			function getShortestPaths(){
				var depth = 1, params = {}; 
				//paramsbuilder populates the params associative array with the names of biomolecules from the querygenes data.
				var paramsbuilder = function () {
					params.startnode = parseInt(data.querygenes[0]);
					params.endnode = parseInt(data.querygenes[data.querygenes.length-1]);
					params.midnodes = [];
					for(i=1; i<data.querygenes.length-1; i++){params.midnodes.push(parseInt(data.querygenes[i]));}
				}
				paramsbuilder();
				//query constructs the query by concatenating various portions of the Cypher query into a single string to be passed to the Neo4j DB. Inprovements for the next version include altering the structure of the query and paramsbuilder functions to minimize need for direct string manipulation.
				var query = function () {
					var queryaddons = ['','','','']; 
					if (data.queryoptions.reltypes !== "ALL") {queryaddons[1] = ":" + data.queryoptions.reltypes;} //stores selected relationship types.
					for(i=0; i<depth-1; i++){queryaddons[0] += '-[' + queryaddons[1] + ']->()';} //stores pathway depth.
					if(data.queryoptions.graphs.length || data.queryoptions.cycles === "false" || params.midnodes.length){
						queryaddons[2] = []; queryaddons[3] = [];
						for(j=0; j<params.midnodes.length; j++){queryaddons[2].push('ANY(n in nodes(p) WHERE id(n) = ' + params.midnodes[j] + ')');} //stores intermediate nodes.
						if(data.queryoptions.cycles === "false") {queryaddons[2].push("ALL(n in nodes(p) WHERE 1=length(filter(m in nodes(p) : m=n)))");} //stores cycles preference.
						for(k=0; k<data.queryoptions.graphs.length; k++){queryaddons[3].push(data.queryoptions.graphs[k]);} //stores selected graphs to traverse.
						if(data.queryoptions.graphs.length){queryaddons[2].push('ALL(n in nodes(p) WHERE n.graphid! IN [' + queryaddons[3].join(',') + '])');}	
						queryaddons[2] = 'WHERE ' + queryaddons[2].join(' AND '); //Strings together all WHERE statements.
					}
					queryaddons[3] = data.queryoptions.pathwaynum-csvdata.length; //Sets pathway number limit by subtracting the amount of retrieved pathways from the user-defined pathway limit.
					var buildquery = ["START startnode=node({startnode}), endnode=node({endnode})", 'MATCH p=(startnode)' + queryaddons[0] + '-[' + queryaddons[1] + ']->(endnode)', queryaddons[2], 'RETURN p', 'LIMIT ' + queryaddons[3] + ''].join('\n'); console.log(buildquery); return buildquery; //String manipulation to build the query.
				}
				var cb = function (err, results) {
					//The results returned will be in the form of an array of pathways of a specific length, each with a list of relationships containing the start node, end node, id, and type in an object.
					if (err) {console.log("Error with query", err); socket.emit('queryerror',{error: err});}
					else {
						var iterationentries = results.length, loopcounter = 0; //iterationentries is the amount of pathways retrieved for this depth. loopcounter is the current pathway number.
						async.mapSeries(results, function (result,cb1) { //Iterates through the pathway list.
							async.mapSeries(result['p']['relationships'],function (relationship, cb2) { //iterates through relationships from each pathway.
								db.graphdb.getRelationshipById(relationship.id, function (err,relationship) { //Retrieves relationship information by querying relationship id.
									if (err) {console.log("Error finding the relationship", err);}
									db.graphdb.getNodeById(relationship.start.id, function (err,startnode) {
										if (err) {console.log("Error finding the start node", err);}
										db.graphdb.getNodeById(relationship.end.id, function (err,endnode) {
											if (err) {console.log("Error finding the end node", err);}
											//innerarr stores information including the start node and end node names, ids, and graph ids, the relationship id and type, and the color corresponding to the graph id and relationship type.
											var innerarr = [startnode.data.name, endnode.data.name, startnode.id, endnode.id, startnode.data.graphid, endnode.data.graphid, relationship.id, color[1].indexOf(relationship.type), relationship.type, color[0].indexOf(startnode.data.graphid.toString())];
											cb2(null,innerarr);
										});
									});
								});
							}, function (err,res) {
								//callback is called after every pathway is stored into the innerarr.
								loopcounter++;
								csvdata.push(res); 
								if(csvdata.length !== parseInt(data.queryoptions.pathwaynum) && iterationentries === loopcounter){depth++; socket.emit('queryresults',{csv:csvdata}, ''); db.graphdb.query(query(),params,cb);} //Streams results for this query to the client-side if another query is necessary and if all the iteration entries have been retrieved.
								else if (csvdata.length === parseInt(data.queryoptions.pathwaynum)) {console.log("CSV", csvdata, csvdata.length); socket.emit('queryresults',{csv:csvdata, noderequests:data.querygenes}); csvdata.length = 0;} //Termination of the query request after the results have all been retrieved. Termination can occur if the pathway number or depth limits are reached.
							});
							cb1();
						},function (err, results) {if(!iterationentries){depth++; db.graphdb.query(query(),params,cb);}});
					}
				};
				db.graphdb.query(query(),params,cb);
			}
			getShortestPaths(); //executes the function that builds, executes, and relays the query.
		}
		//getGeneSnapshot is structured similarly to getShortestPaths. Most comments on structure still apply.
		else if (data.queryoptions.algorithm === "snapshot") {
			//The data received by the getGeneSnapshot algorithm include the biomolecules in query, algorithm used, , number of pathways to retreive, depth max and min, and allowed relationship types.
			function getGeneSnapshot(){
				var depth = data.queryoptions.depthmin, params = {}; 
				var query = function () {
					var queryaddons = ['','','']; 
					if (data.queryoptions.reltypes !== "ALL") {queryaddons[1] = ":" + data.queryoptions.reltypes;} //Stores selected relationship types.
					for(j=0; j<depth-1; j++){queryaddons[0] += '-[' + queryaddons[1] + ']->()';} //Stores pathway length
					queryaddons[2] = data.queryoptions.pathwaynum-csvdata.length; //Sets pathway number limit by subtracting the amount of retrieved pathways from the user-defined pathway limit.
					var buildquery = ['START node0=node({node0})', 'MATCH p=(node0)' + queryaddons[0] + '-[' + queryaddons[1] + ']->()', 'WHERE ALL(r in relationships(p) WHERE NOT(type(r)="EQUALS"))', 'RETURN p', 'LIMIT ' + queryaddons[2]].join('\n'); console.log(buildquery); return buildquery;
				}
				var params = {node0:parseInt(data.querygenes[0])};
				var cb = function (err, results) {
					if (err) {console.log("Error with query", err); socket.emit('queryerror',{error: err});}
					else {
						var iterationentries = results.length, loopcounter = 0; //iterationentries is the amount of pathways retrieved for this depth. loopcounter is the current pathway number.
						async.mapSeries(results, function (result,cb1) {
							async.mapSeries(result['p']['relationships'],function (relationship, cb2) {
								db.graphdb.getRelationshipById(relationship.id, function (err,relationship) {
									if (err) {console.log("Error finding the relationship", err);}
									db.graphdb.getNodeById(relationship.start.id, function (err,startnode) {
										if (err) {console.log("Error finding the start node", err);}
										db.graphdb.getNodeById(relationship.end.id, function (err,endnode) {
											if (err) {console.log("Error finding the end node", err);}
											var innerarr = [startnode.data.name, endnode.data.name, startnode.id, endnode.id, startnode.data.graphid, endnode.data.graphid, relationship.id, color[1].indexOf(relationship.type), relationship.type, color[0].indexOf(startnode.data.graphid.toString())];
											cb2(null,innerarr);
										});
									});
								});
							}, function(err,res){
								loopcounter++;
								csvdata.push(res);
								if(csvdata.length !== parseInt(data.queryoptions.pathwaynum) && iterationentries === loopcounter){depth++; socket.emit('queryresults',{csv:csvdata}, ''); db.graphdb.query(query(),params,cb);}
								else if (csvdata.length === parseInt(data.queryoptions.pathwaynum) || (iterationentries === loopcounter && depth === data.queryoptions.depthmax)) {console.log("CSV", csvdata, csvdata.length); socket.emit('queryresults',{csv:csvdata, noderequests:data.querygenes}); csvdata.length = 0;}
							});
							cb1();
						},function (err, results) {if(!iterationentries){depth++; db.graphdb.query(query(),params,cb);}});
					}
				};
				db.graphdb.query(query(),params,cb);
			}
			getGeneSnapshot();			
		}
	}
	//Called immediately when the query request is sent from the UI.
	socket.on('queryrequest', function (data){
		var index = 0;
		console.time("process"); //Starts a timer to calculate query request time.
		async.eachSeries(data.querygenes,function (item,cb0){
			db.graphdb.query(["START n=node:node_auto_index(name = {n})","RETURN n"].join('\n'),{n: item},function(err,results){
				data.querygenes[data.querygenes.indexOf(item)] = results[0]['n'].id; //Finds the biomolecule Neo4j id corresponding to each biomolecule name. Allows users to search by biomolecule name rather than an arbitrary neo4j id.
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
		db.graphdb.query(annotationsquery(data.querytype), annotationsparams, function(err, results){
			if (err) {console.log("Error with getting Annotation IDs", err);}
			else if (!results.length || (data.querytype === "node" && !results[0]['a'] && !results[0]['b']) || (data.querytype === "link" && !results[0]['a'] && !results[0]['b'])) {console.log("No Annotation IDs found"); socket.emit('annotationreturn', {'err':'noresults'});} //returns an error to the client side error handling function in the cass of no results.
			else { //Sends Annotation IDs for use by REST APIs from UniProt, NCBI Gene, and Pubmed.
				if(data.querytype === "node"){socket.emit('annotationreturn', {'UniProt':results[0]['a'], 'NCBIGene':results[0]['b'], 'err':'',});}
				else if(data.querytype === "link"){socket.emit('annotationreturn', {'source':results[0]['a'], 'pubmed':results[0]['b'], 'err':'',});}
			}
		});
	});
	socket.on('time',function(data){console.timeEnd("process");}) //Ends timer for query request. (For logging purposes only.)
}