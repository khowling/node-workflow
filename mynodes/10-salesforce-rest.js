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


function SalesforceGetNode(n) {
    RED.nodes.createNode(this,n);
    this.active = true;
    
    this.importtype = n.importtype;
    this.sobject = n.sobject;
    this.salesforce = n.salesforce;
    
    this.topic = n.topic||"sfdc";
    this.salesforceConfig = RED.nodes.getNode(this.salesforce);
    var credentials = RED.nodes.getCredentials(this.salesforce);
    if (credentials && credentials.screen_name == this.salesforceConfig.screen_name) {

    	var node = this;		
		node.poll_ids = [];
	    
		
	    node.poll_ids.push(setInterval(function() {
	    	
	    	/* get the username */ 
	        var getres = '', getopts = {
	            	hostname: url.parse(credentials.instance_url).hostname,
	                path: '/services/data/v28.0/query/?q=SELECT+Name+FROM+Account',
	                headers:{
	                	'Authorization': 'Bearer '+ credentials.access_token
	                }};
	      
	        https.get (getopts, function (res_data) {
	        	res_data.setEncoding('utf8');
	        	res_data.on('data', function (chunk) { getres += chunk; });
	        	res_data.on('end', function () {
	        		
	        		console.log("Got response: " + res_data.statusCode);
					  var msg = { 
							  topic:node.topic+"/"+credentials.screen_name, 
							  payload:getres, 
							  other: "other" };
					  
	                  node.send(msg);
	          	});
	        }).on('error', function(e) {
	        	console.log("Got error: " + e.message);
	        	res.send("yeah something broke.");
	        });
	    	

		}, 6000));

        
    } else {
        this.error("missing salesforce credentials");
    }

    this.on('close', function() {
       
        if (this.poll_ids) {
            for (var i=0;i<this.poll_ids.length;i++) {
                clearInterval(this.poll_ids[i]);
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

RED.app.get('/salesforce/:id/sobjects', function(req,res) {
	console.log ('get sobjects for node ' + req.params.id);
	var credentials = RED.nodes.getCredentials(req.params.id);
    
    /* get the username */ 
    var getres = '', getopts = {
        	hostname: url.parse(credentials.instance_url).hostname,
            path: '/services/data/v26.0/sobjects',
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
        function(error, oauth_access_token, oauth_access_token_secret, results){
            if (error){
                console.log(error);
                res.send("yeah something broke.");
            } else {
            	console.log(results);

                credentials = {};
                credentials.access_token = oauth_access_token;
                credentials.access_token_secret = oauth_access_token_secret;
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


