/**
 * 
 */


var RED = require(process.env.NODE_RED_HOME+"/red/red");
var https = require("https"),
    OAuth= require('oauth'),
    url = require('url');



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
	node.salesforce = n.salesforce;
	node.interval = n.interval;
	node.topic = n.topic||"sfdc";
	
	node.log ('calling SalesforceGetNode() : ' + node.importtype + ' : ' + node.sobject + ' : ' + node.interval);
	
	node.salesforceConfig = RED.nodes.getNode(node.salesforce); // the 'salesforce-credentials' node
    
    var credentials = RED.nodes.getCredentials(node.salesforce);
    node.log ('credentials:' + JSON.stringify(credentials) + ', "salesforce-credentials".screen_name: '+ node.salesforceConfig.screen_name);
    
    if (credentials && credentials.screen_name == node.salesforceConfig.screen_name) {


		node.poll_ids = [];
		
		node.deactivate = function() {
			node.log ('deactivate salesforce-in');
			node.active = false;
			
			if (node.poll_ids) {
	            for (var i=0;i<node.poll_ids.length;i++) {
	                clearInterval(node.poll_ids[i]);
	            }
	        }
		}
		
		node.activate = function() {
			node.log ('activating salesforce-in');
			node.active = true;
		    node.poll_ids.push(setInterval(function() {
		    	
		    	/* get the username */ 
		        var getopts = {
		            	hostname: url.parse(credentials.instance_url).hostname,
		                path: '/services/data/v28.0/query/?q='+encodeURIComponent('SELECT '+node.sobject_fields+' FROM '+node.sobject),
		                headers:{
		                	'Authorization': 'Bearer '+ credentials.access_token
		                }};
	
			    var runextract = function() {
			    	var getres = ''
			    	https.get (getopts, function (res_data) {
			        	res_data.setEncoding('utf8');
			        	res_data.on('data', function (chunk) { getres += chunk; });
			        	res_data.on('end', function () {
			        		
			        		console.log("Got response: " + res_data.statusCode);
							
			        		if (res_data.statusCode == 401) {
			        			node.warn ( 'Unauthorized, do a refresh cycle');
			        		    if (credentials.refresh_token != null) {
				        			oa.getOAuthAccessToken(
			        		    		credentials.refresh_token,
			        		        	{ grant_type: 'refresh_token',   redirect_uri: redirectUrl, format: 'json'},
			        		            function(error, oauth_access_token, oauth_refresh_token, results){
			        		                if (error){
			        		                	node.deactivate();
			        		                    node.error("Error with Oauth refresh cycle " + JSON.stringify(error));
			        		                } else {
			        		                	node.log('updating access_token from refresh process ' + JSON.stringify(results));
			        		                    credentials.access_token = oauth_access_token;
			        		                    RED.nodes.deleteCredentials(this.salesforce);
			        		                    RED.nodes.addCredentials(this.salesforce,credentials);
			        		                    runextract();
			        		                }
			        		        	});
			        			} else {
			        				node.deactivate();
			        				node.error("No refresh Token, ensure your connected app is setup to allow refresh scope & only login on first use");
			        				
			        			}
			        		} else if (res_data.statusCode == 200) {
				        		var msg = { 
									 topic:node.topic+"/"+credentials.screen_name, 
									 payload:getres, 
									 other: "other" };
								  
				                  node.send(msg);
			        		} else {
			        			node.deactivate();
			        			console.log(res_data.statusCode);
			        			node.error("yeah something broke." + res_data.statusCode);
			        		}
			          	});
			        }).on('error', function(e) {
			        	console.log("Got error: " + e.message);
			        	node.deactivate();
			        	res.send("yeah something broke.");
			        });
			    };
			    
			    runextract();
			    
	
			}, (node.interval * 1000)));
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
		mode = (req.params.mode == 'all') ? '' : ('/'+req.params.mode+'/describe');
	
	console.log ('get sobjects for node ' + nodeid + ', mode : ' + mode);
	var credentials = RED.nodes.getCredentials(nodeid);
    
    /* get the username */ 
    var getres = '', getopts = {
        	hostname: url.parse(credentials.instance_url).hostname,
            path: '/services/data/v26.0/sobjects' + mode,
            headers:{
            	'Authorization': 'Bearer '+ credentials.access_token
            }};
  
    https.get (getopts, function (res_ident) {
    	res_ident.setEncoding('utf8');
    	res_ident.on('data', function (chunk) { getres += chunk; });
    	res_ident.on('end', function () {
      	  	res.send(getres);
      	});
    }).on('error', function(e) {
    	console.log("Got error: " + e.message);
    	res.send("yeah something broke.");
    });
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


