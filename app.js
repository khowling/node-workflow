/**
 * New node file
 */
var http = require('http');
var express = require("express");
var RED = require("node-red");

// Create an Express app
var app = express();

// Add a simple route for static content served from 'public'
app.use("/",express.static("public"));

// Create a server
var server = http.createServer(app);

// Create the settings object
var settings = {httpRoot:"/", nodesDir: __dirname+'/mynodes'};
console.log ('RED Settings : ' + JSON.stringify(settings));

// Initialise the runtime with a server and settings
RED.init(server,settings);

// Serve the editor UI from /red
app.use(settings.httpRoot,RED.app);

server.listen(1880);

// Start the runtime
RED.start();