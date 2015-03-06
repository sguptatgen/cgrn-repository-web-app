var socket = io.connect('http://localhost:8080');
$(document).ready(function() {
	socket.on('queryresults', function (data) {
		if(data.csv) {
			//Raw CSV Manipulation
				var d3csv = [];
				data.csv.forEach(function(element,index,array){
					for(i=0; i<element.length; i++){
						if(element[i][8] === "EQUALS"){
							if(element[i-1] && element[i+1]){element[i+1][0] = element[i-1][1]; element[i+1][2] = element[i-1][3];}
							else if(!element[i-1]){element[i+1][0] = element[i][0]; element[i+1][2] = element[i][2];}
							else if(!element[i+1]){element[i-1][1] = element[i][1]; element[i-1][3] = element[i][3];}
	 						element.splice(i,1);
						}
					}
				});
				$('#tabular').html('');
				data.csv.forEach(function(element,index,array) {
					$("#tabular").append('<div class="tabulardiv"><h2 class="resultheaders" id="result' + index + '">Pathway Result ' + (index + 1) + '</h2><table class="results"><tr><th>Start Biomolecule</th><th>End Biomolecule</th><th>Interaction Type</th></tr></table></div>');
					for(i=0; i<element.length; i++){
						$(".results:eq(" + index + ")").append('<tr><td>' + element[i][0] + '</td><td>' + element[i][1] + '</td><td>' + element[i][8].toLowerCase().replace(/\_/," ") + '</tr>');
						d3csv.push(element[i]+','+index);
					}
				});
			//Graph Generation
				var nodes = {};
				d3csv = 'source,target,sourceid,targetid,sourcegraph,targetgraph,relid,relcolor,reltype,graphcolor,pathway\n' + d3csv.join('\n');
				console.log(d3csv);
				var links = d3.csv.parse(d3csv);
				links.forEach(function(link) {
					link.source = nodes[link.source] || (nodes[link.source] = {name: link.source, nodeid: link.sourceid, graphid: link.sourcegraph});
					link.target = nodes[link.target] || (nodes[link.target] = {name: link.target, nodeid: link.targetid, graphid: link.targetgraph});
					link.relcolor = +link.relcolor;
				});
				var width = 600, height = 600, color = ["#2ca02c", "#1f77b4", "#ff7f0e", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
				var force = d3.layout.force().nodes(d3.values(nodes)).links(links).size([width, height]).linkDistance(110).charge(-1300).gravity(0.3).on("tick", tick).start();
				d3.select("#graph").html('').select("*").remove();
				var svg = d3.select("#graph").append("svg").attr("width", width).attr("height", height);

				// build the arrow.
				var defs = svg.append("svg:defs");
				var arrow = defs.selectAll("marker").data(["end"]).enter().append("svg:marker").attr("id", String).attr("viewBox", "0 -5 10 10").attr("refX", 20).attr("refY", -2).attr("markerWidth", 3).attr("markerHeight", 3).attr("orient", "auto").append("svg:path").attr("d", "M0,-5L10,0L0,5").style('fill','rgba(0,0,0,0.6)');
				
				//build the glow effect
				var glow = defs.append("filter").attr("id","glow").attr("height","1000%").attr("width","1000%");
				glow.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation",5).attr("result","blur");
				glow.append("feOffset").attr("in","blur").attr("dx",0).attr("dy",0).attr("result","offsetBlur");
				var feMerge = glow.append("feMerge"); feMerge.append("feMergeNode").attr("in","offsetBlur"); feMerge.append("feMergeNode") .attr("in", "SourceGraphic");

				// add the links and the arrows
				var path = svg.append("svg:g").selectAll("path").data(force.links()).enter().append("svg:path").attr("class", function(d){return "link pathway"+d.pathway;}).attr("id",function(d) { return "link_" + d.relid}).attr("title",function(d){return d.source.name + "*_" + d.target.name + "*_" + d.reltype;}).style("stroke",function(d){return color[d.graphcolor];}).attr("viewBox","0 0 50 50").attr('marker-end','url(#end)');

				// define the nodes
				var node = svg.selectAll(".node").data(force.nodes()).enter().append("g").attr("class", "node").attr("id",function(d) { return "node_" + d.nodeid; }).attr("title",function(d){return d.nodeid;}).call(force.drag);

				// add the nodes
				node.append("circle").attr("r", "10").style("fill","rgba(0,112,255,1)");
				var genelabel = node.append("text").attr("dy", "0.3em").style('font-size','14px').style('text-anchor','middle').text(function(d) { return d.name; });
				$.each(data.noderequests,function(index,elem){
					$("#node_" + elem +" circle").css("fill","rgba(227,66,52,1)");
				});
				// add the curvy lines
				var annotationlock = true;
				function tick() {
					$(".link").attr("filter","");
					path.attr("d", function(d) {
						var diffX = d.target.x - d.source.x,
							diffY = d.target.y - d.source.y,
							dr = Math.sqrt(diffX * diffX + diffY * diffY);
						return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
					});
					node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
					if(force.alpha() < 0.01){$(".pathway0").attr("filter","url(#glow)");};
				}
				$(".resultheaders").click(function(){
					$(".link").attr("filter","");
					$(".pathway"+$(".resultheaders").index(this)).attr("filter","url(#glow)");
				});
		} 
		else {console.log("There is a problem:", data);}
		//Annotation Tooltip
			$(".node, .link").hover(function(evt){
				var notesid = parseInt($(this).attr("id").replace(/node\_|link\_/,"")), idtype;
				console.log(notesid);
				if($(this).attr("class").indexOf('node') !== -1){idtype = "node"; $("#tooltip").html("<b>" + $(this).children("text").eq(0).text() + "</b><br/>Annotations loading...");}
				else if($(this).attr("class").indexOf('link') !== -1){
					var relinfo = $(this).attr("title").split("*_");
					idtype = "link"; $("#tooltip").html("<b>Interaction: " + relinfo[0] + "→" + relinfo[1] + "</b><br/>Annotations loading...");
				}
				$("#tooltip").css("display","block");
				$("#tooltip").css('top',evt.pageY + 5);
				$("#tooltip").css('left',evt.pageX + 5);
				if(!annotationlock){$("#tooltip").fadeIn(300, 'swing');}
				socket.emit('annotationrequest', { 'queryitem': notesid, 'querytype': idtype});
			},function(){
				$("#tooltip").fadeOut(300, 'swing');
				$("#tooltip").html("");
			});	
		//Timer			
			if($("table").length == $('#pathwaynuminput').val()){socket.emit("time",{});}
	});
	//Annotations
		socket.on('annotationreturn', function (data) {
			if(data.UniProt) {
				$.ajax({
					url: "http://www.uniprot.org/uniprot/" + data.UniProt[0] + ".xml", type: 'GET', 
					success: function (parsexml){
						$("#tooltip").html($("#tooltip").html().replace(/Annotations loading\.\.\./, ""));
						$(parsexml).find('comment[type = "function"] text').each(function(){$("#tooltip").append("<i>UniProt:</i> " + $(this).text() + "<br/>");});}, 
					error: function(jqXHR, string, err){$("#tooltip").append("No UniProt Information available<br/>");}, 
					dataType: "xml"
				});
			}
			if(data.NCBIGene) {
				$.ajax({
					url: "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=gene&id=" + data.NCBIGene + "&retmode=XML", type: 'GET', 
					success: function (parsexml){
						$("#tooltip").html($("#tooltip").html().replace(/Annotations loading\.\.\./, ""));
						$(parsexml).find('Entrezgene_summary').each(function(){$("#tooltip").append("<i>NCBI Gene:</i> " + $(this).text() + "<br/>");});}, 
					error: function(jqXHR, string, err){$("#tooltip").append("No NCBI Gene Information available<br/>");}, 
					dataType: "xml"
				});
			}
			if(data.source) {
				$("#tooltip").html($("#tooltip").html().replace(/Annotations loading\.\.\./, ""));
				$("#tooltip").append("<i>Source:</i> " + data.source + "<br/>");
			}
			if(data.pubmed) {
				$.ajax({
					url: "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=" + data.pubmed + "&retmode=XML", type: 'GET', 
					success: function (parsexml){
						$("#tooltip").html($("#tooltip").html().replace(/Annotations loading\.\.\./, ""));
						$(parsexml).find('AbstractText').each(function(){$("#tooltip").append("<i>PubMed:</i> " + $(this).text() + "<br/>");});}, 
					error: function(jqXHR, string, err){$("#tooltip").append("No PubMed Information available<br/>");}, 
					dataType: "xml"
				});
			}			 
			else if (data.err === 'noresults') {$("#tooltip").html($("#tooltip").html().replace(/Annotations loading\.\.\./, "")); $("#tooltip").append("No annotations available.<br/>");}
		});
	//Error Handling for Query
		socket.on('queryerror', function(data){
			var errormessage;
			if(data.error.message.search("^timeout occured")!==-1){errormessage = "Sorry, there were no results that could be relayed in time. Please try another query."}
			$('#graph').html(errormessage);
		});
	//Submitting a Query + Form JS
		$(".addgene").click(function() {
		$('#intermediates').append('<input type="text" value="Type a gene here!" class="geneinput"/>');
		});
		$('#submitquery').click(function() {
			$("#graph").html("Loading...");
			if ($('#algorithminput').val() === "shortest") {
				var geneparams = [], options = {}; options.graphs = [];
				for(i=0; i<$('.geneinput').filter(":visible").length; i++) {geneparams.push($('.geneinput').filter(":visible").eq(i).val());}
				for(j=0; j<$('.graphtraversalinput:checked').filter(":visible").length; j++) {options.graphs.push($('.graphtraversalinput:checked').filter(":visible").eq(j).val());}
				options.algorithm = $('#algorithminput').val(); options.pathwaynum = $('.pathwaynuminput').filter(":visible").val(); options.reltypes = $('.reltypeinput').filter(":visible").val(); options.cycles = $(".cyclesinput").filter(":visible").val();
			}
			else if ($('#algorithminput').val() === "snapshot") {
				var geneparams = [], options = {}; options.graphs = [];
				for(i=0; i<$('.geneinput').filter(":visible").length; i++) {geneparams.push($('.geneinput').filter(":visible").eq(i).val());}
				options.algorithm = $('#algorithminput').val(); options.pathwaynum = parseInt($('.pathwaynuminput').filter(":visible").val()); options.reltypes = $('.reltypeinput').filter(":visible").val(); options.depthmin = parseInt($('.depthinput:eq(0)').val()); options.depthmax = parseInt($('.depthinput:eq(1)').val());
			}
			console.log(geneparams, options);
			socket.emit('queryrequest', {querygenes: geneparams, queryoptions: options});
		});
		$('#algorithminput').change(function(){
			if($(this).val() === "shortest"){$('#snapshot').css("display","none"); $('#shortest').css("display","block");}
			else if($(this).val() === "snapshot"){$('#snapshot').css("display","block"); $('#shortest').css("display","none");}
		});
		$('.geneinput').focus(function(){if($(this).val().search("^Type ")!==-1){$(this).data("help",$(this).val()); $(this).val('');}});
		$('.geneinput').blur(function(){if($(this).val()===""){$(this).val($(this).data("help"));}});
});	