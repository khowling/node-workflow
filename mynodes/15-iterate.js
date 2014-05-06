/**
 * Copyright 2013 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var RED = require(process.env.NODE_RED_HOME + "/red/red");

function IterateNode(n) {
    RED.nodes.createNode(this, n);
    this.action = n.action;
    this.property = n.property || "";
    this.from = n.from || " ";
    this.to = n.to || " ";
    this.reg = (n.reg === null || n.reg);
    var node = this;
    if (node.reg === false) {
        this.from = this.from.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    }
    var makeNew = function( stem, path, value ) {
        var lastPart = (arguments.length === 3) ? path.pop() : false;
        for (var i = 0; i < path.length; i++) {
            stem = stem[path[i]] = stem[path[i]] || {};
        }
        if (lastPart) { stem = stem[lastPart] = value; }
        return stem;
    };

    this.on('input', function (msg) {
    	
    	if (node.action == "array") {
    		
            msg[node.property].forEach(function(d){ 
            	if (n.to) {
            		var outp = d[n.to];
            		if (outp) {
	            		console.log ('filtering by  [' + n.to + ']  ' + outp);
	            		node.send({ 
								 topic:n.name+"/"+n.to, 
								 payload:outp });
            		}
            	} else {
            		node.send(d); 
            	}
            	});
            

    	} else {
    	
	        if (node.action == "change") {
	            try {
	                node.re = new RegExp(this.from, "g");
	            } catch (e) {
	                node.error(e.message);
	            }
	            if (typeof msg[node.property] === "string") {
	                msg[node.property] = (msg[node.property]).replace(node.re, node.to);
	            }
	        }
	        //else if (node.action == "replace") {
	            //if (node.to.indexOf("msg.") == 0) {
	                //msg[node.property] = eval(node.to);
	            //}
	            //else {
	                //msg[node.property] = node.to;
	            //}
	        //}
	        else if (node.action == "replace") {
	            if (node.to.indexOf("msg.") == 0) {
	                makeNew( msg, node.property.split("."), eval(node.to) );
	            }
	            else {
	                makeNew( msg, node.property.split("."), node.to );
	            }
	            //makeNew( msg, node.property.split("."), node.to );
	        }
	
	        node.send(msg);
    	}
    });
}
RED.nodes.registerType("iterate", IterateNode);