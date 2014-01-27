/**
 * 
 */
var RED = require(process.env.NODE_RED_HOME+"/red/red");
var https = require("https"),
    OAuth= require('oauth'),
    url = require('url'),
    Faye = require('faye');



function SalesforceNode(n) {
    RED.nodes.createNode(this,n);
    this.screen_name = n.screen_name;
}
RED.nodes.registerType("salesforce-credentials",SalesforceNode);

/* Run when the node is deplyed */
function SalesforceGetNode(n) {
	var node = this;
	RED.nodes.createNode(node,n);

	node.importtype = n.importtype;
	node.sobject = n.sobject;
	node.sobject_fields = n.sobject_fields;
	node.soql = n.soql;
	node.salesforce = n.salesforce;
	node.interval = n.interval;
	node.push_topic = n.push_topic;
	
	node.log ('calling SalesforceGetNode() : ' + node.importtype + ' : ' + node.sobject + ' : ' + node.interval);
	
	node.salesforceConfig = RED.nodes.getNode(node.salesforce); // the 'salesforce-credentials' node
    
    var credentials = RED.nodes.getCredentials(node.salesforce);
    node.log ('credentials:' + JSON.stringify(credentials) + ', "salesforce-credentials".screen_name: '+ node.salesforceConfig.screen_name);
    
    if (credentials && credentials.screen_name == node.salesforceConfig.screen_name) {

		node.poll_ids = [];
		node.deactivate = function() {
			node.log ('deactivate salesforce-in');
			node.active = false;
			
			if (node._fayeClient) {
				node.log ('Unsubscribing from ' + node.push_topic);
				node._fayeClient.unsubscribe("/topic/"+node.push_topic)
			}
			
			if (node.poll_ids) {
	            for (var i=0;i<node.poll_ids.length;i++) {
	                clearInterval(node.poll_ids[i]);
	            }
	        }
		}
		
		node.activate = function() {
			node.log ('activating salesforce-in');
			node.active = true;
			
			/* complete logic to run the Node */
			var runNode = function() {
		    	
				/* complete logic to support 'SOQL' or 'SOBJECT' modes */
		    	var runextract = function() { 
		    		
			    	var query = '';
			    	if (node.importtype == 'soql') {
			    		query = node.soql;
			    	} else if (node.importtype == 'sobjects') {
			    		query = 'SELECT '+node.sobject_fields+' FROM '+node.sobject;
			    	}
			    	
			        var getopts = {
			            	hostname: url.parse(credentials.instance_url).hostname,
			                path: '/services/data/v29.0/query/?q='+encodeURIComponent(query),
			                headers:{
			                	'Authorization': 'Bearer '+ credentials.access_token
			                }};

			    	var getres = ''
			    	https.get (getopts, function (res_data) {
			        	res_data.setEncoding('utf8');
			        	res_data.on('data', function (chunk) { getres += chunk; });
			        	res_data.on('end', function () {
			        		if (res_data.statusCode == 401) {
			        			
			        			node.warn ( 'Unauthorized, do a refresh cycle');
			        			oAuthRefresh(node.salesforce, function() {
			        				runextract();
			        			}, function(msg) {
			        				node.deactivate();
			        				node.error(msg);

			        			})

			        		} else if (res_data.statusCode == 200) {
				        		var msg = { 
									 topic:node.importtype+"/"+credentials.screen_name, 
									 payload:JSON.parse(getres).records, 
									 other: "other" };
								  
				                  node.send(msg);
			        		} else {
			        			node.deactivate();
			        			node.error("yeah something broke." + res_data.statusCode);
			        		}
			          	});
			        }).on('error', function(e) {
			        	node.deactivate();
			        	node.error("Got REST API error: " + e.message);
			        });
			    };
			    

		    	if (node.importtype == 'soql' || node.importtype == 'sobjects') {
		    		runextract();
		    	} else if (node.importtype == 'StreamingAPI') {
		    		
		    		node.log ('Proactive oauth refresh');
		    		oAuthRefresh(node.salesforce, function() {
        				
			    		/* source : https://github.com/faye/faye/blob/master/javascript/protocol/client.js */
			    		if (!node._fayeClient) {
			    		    Faye.Transport.NodeHttp.prototype.batching = false; // prevent streaming API server error
			    		    Faye.Logging.LOG_LEVELS = 0;
			    		    node._fayeClient = new Faye.Client(credentials.instance_url + '/cometd/29.0', {});
			    		    node._fayeClient.setHeader('Authorization', 'Bearer '+ credentials.access_token);
			    		}
		    		    node.log ('subscript Faye Client : ' + "/topic/"+node.push_topic);
		    		    
		    		    node._streamListener = function (message) {
		    		    	node.log ('Got message : ' + message);
			    			var msg = { 
								 topic:node.importtype+"/"+credentials.screen_name, 
								 payload:message, 
								 other: "other" };
							  
			                  node.send(msg);
		    		    };
		    		    
			    		node._fayeClient.subscribe("/topic/"+node.push_topic, node._streamListener); 
			    		
        			}, function(msg) {
        				node.deactivate();
        				node.error(msg);

        			})
        			 
		    	} else {
		    		node.deactivate();
		        	node.error("importtype not yet implemented: " + node.importtype);
		    	} 

			};
			
			
			/* run the node for the 1st time */
			runNode();
			
			/* setup Polling Interval */
			if (node.interval > 0 && node.importtype != 'StreamingAPI') {
				node.poll_ids.push(setInterval(runNode, (node.interval * 1000)));
			}
		}
		if (n.active) node.activate();
        
    } else {
    	node.error("missing salesforce credentials");
    }

    node.on('close', function() {
        if (node.poll_ids) {
            for (var i=0;i<node.poll_ids.length;i++) {
                clearInterval(node.poll_ids[i]);
            }
        }
    });
}
RED.nodes.registerType("salesforce in",SalesforceGetNode);


function SalesforcePutNode(n) {
	var node = this;
    RED.nodes.createNode(node,n);
    
	node.sobject = n.sobject;
	node.salesforce = n.salesforce;
	
	node.log ('calling SalesforcePutNode() : ' + node.sobject);
	
	node.salesforceConfig = RED.nodes.getNode(node.salesforce); // the 'salesforce-credentials' node
    
    var credentials = RED.nodes.getCredentials(node.salesforce);
    node.log ('credentials:' + JSON.stringify(credentials) + ', "salesforce-credentials".screen_name: '+ node.salesforceConfig.screen_name);
    
    if (credentials && credentials.screen_name == node.salesforceConfig.screen_name) {
    	
    	node.log ('Setting up on-input for :' + credentials.screen_name);
		node.on("input",function(msg) {
			
	        var postopts = {
	            	hostname: url.parse(credentials.instance_url).hostname,
	                path: '/services/data/v29.0/sobjects/'+ node.sobject + '/',
	                method: 'POST',
	                headers:{
	                	'Content-Type' : 'application/json',
	                	'Authorization': 'Bearer '+ credentials.access_token
	                }};
	        
	        node.log('Sending Post ' + JSON.stringify(postopts) + ' DATA : ' + msg.payload);
	    	var getres = ''
	    	var req_data = https.request (postopts, function (res_data) {

	        	res_data.on('data', function (chunk) { getres += chunk; });
	        	res_data.on('end', function () {
	        		if (res_data.statusCode == 401) {
	        			
	        			node.warn ( 'Unauthorized, do a refresh cycle');
	        			oAuthRefresh(node.salesforce, function() {
	        				runextract();
	        			}, function(msg) {
	        				node.error(msg);
	
	        			})
	
	        		} else if (res_data.statusCode == 201) {
		                node.log('success');
	        		} else {
	        			node.error("yeah something broke." + res_data.statusCode + ' : ' + getres);
	        		}
	          	});
	        }).on('error', function(e) {
	        	node.error("Got REST API error: " + e.message);
	        });
	    	req_data.write(msg.payload);
	    	req_data.end();
	         
	    });
	}
}
RED.nodes.registerType("salesforce out",SalesforcePutNode);



/* Oauth2 Authentication */

var OAuth2 = OAuth.OAuth2;
var clientId = '3MVG99qusVZJwhsk83uqoOkE0Ihw6qqRAYSeIL1v2Tl7CcZ3ERM0oNXxm5XgY9V5Alq.ps_.m1wM4EF9Yz6YD',
	redirectUrl = 'http://localhost:1880/salesforce/auth/callback';
var oa = new OAuth2(
		clientId,
		'1230682505783547613', 
		'https://login.salesforce.com/', 
		'services/oauth2/authorize',
		'services/oauth2/token', 
		null);



var credentials = {};
var oAuthRefresh = function(nodeid, successcallback, errorcallback) {
	
	var credentials = RED.nodes.getCredentials(nodeid);

	if (credentials.refresh_token != null) {
		oa.getOAuthAccessToken(
			credentials.refresh_token,
	    	{ grant_type: 'refresh_token',   redirect_uri: redirectUrl, format: 'json'},
	        function(error, oauth_access_token, oauth_refresh_token, results){
	            if (error){
	            	errorcallback ("Error with Oauth refresh cycle " + JSON.stringify(error));
	            } else {
	                credentials.access_token = oauth_access_token;
	                RED.nodes.deleteCredentials(nodeid);
	                RED.nodes.addCredentials(nodeid,credentials);
	                successcallback();
	            }
	    	});
	} else {
		errorcallback ("No refresh Token, ensure your connected app is setup to allow refresh scope & only login on first use");
		
	}
}

RED.app.get('/salesforce/:id', function(req,res) {
    var credentials = RED.nodes.getCredentials(req.params.id);
    if (credentials) {
        res.send(JSON.stringify({sn:credentials.screen_name}));
    } else {
        res.send(JSON.stringify({}));
    }
});

RED.app.delete('/salesforce/:id', function(req,res) {
    RED.nodes.deleteCredentials(req.params.id);
    res.send(200);
});

RED.app.get('/salesforce/:id/sobjects/:mode', function(req,res) {
	var nodeid = req.params.id,
		mode = 'sobjects' + ((req.params.mode == 'all') ? '' : ('/'+req.params.mode+'/describe'));
	
	if (req.params.mode == 'StreamingAPI') {
		mode = 'query/?q='+encodeURIComponent('select Id, Name, Query, ApiVersion, IsActive, NotifyForFields, NotifyForOperations from PushTopic');
	}
	console.log ('Get salesforce MetaData for Node ' + nodeid + ', mode : ' + mode);
	
	var getMetaSObjectDate = function() {
		var credentials = RED.nodes.getCredentials(nodeid);
	    
	    /* get the username */ 
	    var getres = '', getopts = {
	        	hostname: url.parse(credentials.instance_url).hostname,
	            path: '/services/data/v29.0/' + mode,
	            headers:{
	            	'Authorization': 'Bearer '+ credentials.access_token
	            }};
	  
	    https.get (getopts, function (res_ident) {
	    	res_ident.setEncoding('utf8');
	    	res_ident.on('data', function (chunk) { getres += chunk; });
	    	res_ident.on('end', function () {
	    		console.log ('MetaData results ' + res_ident.statusCode + ', got:' + getres);
	    		if (res_ident.statusCode == 401) {
	    			console.log ( 'Unauthorized, do a refresh cycle');
	    			oAuthRefresh(nodeid, function() {
	    				getMetaSObjectDate();
	    			}, function(msg) {
	    				res.send({ sobjects: [ {name: 'ERROR', label: msg}]});
	    			});
	    		}
	    		else if (res_ident.statusCode == 200) {	
	    			
	      	  		res.send(getres);
	    		} else {
	    			res.send({ sobjects: [ {name: 'ERROR', label: res_ident.statusCode}]});
	    		}
	      	});
	    }).on('error', function(e) {
	    	console.log("Got error: " + e.message);
	    	res.send("yeah something broke.");
	    });
	 };
	 getMetaSObjectDate();
});

RED.app.post("/salesforce/:id/activate/:state", function(req,res) {
	var node = RED.nodes.getNode(req.params.id);
	var state = req.params.state;
	if (node != null) {
	    if (state === "enable") {
	        node.activate();
			res.send(200);
	    } else if (state === "disable") {
	        node.deactivate();
			res.send(201);
	    } else {
	        res.send(404);
	    }
	} else {
		res.send(404);
	}
});

RED.app.get('/salesforce/:id/auth', function(req, res){
	res.redirect(oa.getAuthorizeUrl({ 
        response_type: 'code', 
        client_id: clientId,
        redirect_uri: redirectUrl,
        display: 'page',
        state: req.params.id}));
});

RED.app.get('/salesforce/auth/callback', function(req, res, next){
	console.log ('callback state : ' + req.param('state'));
	console.log ('callback state : ' + req.param('code'));
    var credentials = RED.nodes.getCredentials(req.param('state'));

    oa.getOAuthAccessToken(
    	req.param('code'),
    	{ grant_type: 'authorization_code',   redirect_uri: redirectUrl, format: 'json'},
        function(error, oauth_access_token, oauth_refresh_token, results){
            if (error){
                console.log("Got error: " + error);
                res.send("yeah something broke.");
            } else {
            	console.log('request authorisation_code, got at: ' + oauth_access_token + ', rt: ' + oauth_refresh_token + ', rest: ' + JSON.stringify(results));

                credentials = {};
                credentials.access_token = oauth_access_token;
                credentials.refresh_token = oauth_refresh_token;
                credentials.identity_url = url.parse(results.id);
                credentials.instance_url = results.instance_url;
                
                /* get the username */ 
                var getres = '', getopts = {
                    	hostname: url.parse(credentials.instance_url).hostname,
                        path: credentials.identity_url.path,
                        headers:{
                        	'Authorization': 'Bearer '+ credentials.access_token
                        }};
              
                https.get (getopts, function (res_ident) {

                	res_ident.setEncoding('utf8');
                	res_ident.on('data', function (chunk) { getres += chunk; });
                	res_ident.on('end', function () {
    	          	     var obj = JSON.parse(getres);
    	          	  	 credentials.screen_name = obj.username;
    	          	  	 RED.nodes.addCredentials(req.param('state'),credentials);
    	          	  	 res.send("<html><head></head><body>Authorised - you can close this window and return to Node-RED</body></html>");
    	          	});
                }).on('error', function(e) {
                	console.log("Got error: " + e.message);
                	res.send("yeah something broke.");
                });
            }
        }
    );
});


