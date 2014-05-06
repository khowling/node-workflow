/**
 * New node file
 */
var	  http = require('http')
	, express = require("express")
	, path = require('path')
	, RED = require("node-red");

// Create an Express app
var app = express();

// Add a simple route for static content served from 'public'
app.use(express.static(path.join(__dirname, 'public')));
//	.use (require('body-parser')());

// Create a server
var server = http.createServer(app);

// Create the settings object
var settings = {
		httpAdminRoot:"/",
	    httpNodeRoot: "/api",
	    nodesDir: __dirname+'/mynodes'};

console.log ('RED Settings : ' + JSON.stringify(settings));

// Initialise the runtime with a server and settings
RED.init(server,settings);

//Serve the editor UI from /red
app.use(settings.httpAdminRoot,RED.httpAdmin);

// Serve the http nodes UI from /api
app.use(settings.httpNodeRoot,RED.httpNode);

server.listen(1880);

// Start the runtime
RED.start();