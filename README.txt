

A exciting project using node-red,  I've built a salesforce adapter!

Example worksheet

[{"type":"tab","id":"db50bff6.24af4","label":"Mongo and Apache Solr  Product Worksheet"},{"type":"tab","id":"3873bbe7.c78c44","label":"Sheet 1"},{"id":"54f3317d.ab0cd","type":"salesforce-credentials","screen_name":"khowling@telco.dev"},{"id":"8671145b.798ee8","type":"mongodb","hostname":"127.0.0.1","port":"27017","db":"test","name":"Mongo Local Test Database"},{"id":"69a7024d.9658fc","type":"salesforce-credentials","screen_name":"khowling@telco.dev"},{"id":"4716a9c6.b8e958","type":"http request","name":"Solr POST","method":"POST","url":"http://localhost:8983/solr/collection1/update?wt=json","x":524.5555725097656,"y":490.77777099609375,"z":"db50bff6.24af4","wires":[[]]},{"id":"f203d746.0dfc28","type":"function","name":"SFDC to Heroku SOLR","func":"// Map salesforce Product__c schema to Solr Index\nvar sfdcobj = msg.payload;\n\n// Correct 'Id' to 'id'\nsfdcobj.id = sfdcobj.Id;\ndelete sfdcobj.Id;\n\n// Correct Date Format\nsfdcobj.CreatedDate = sfdcobj.CreatedDate.replace(/\\+0000/gi, \"Z\");\n\n// Split Tariff into Array\nvar code_json = [];\nif (sfdcobj.Available_Tariffs__c != null) {\n\tsfdcobj.Available_Tariffs__c.split(',').forEach(function(c, i) {\n\t\tvar v1 = c.trim();\n\t\tif (v1 != '') code_json.push (v1);\n\t});\n}\nsfdcobj.Available_Tariffs__c =  code_json;\n\t\t\t\t\t        \t\n// Solr Body Format\nreturn {\n\t\"payload\": {\"add\":\n\t\t{ \t\"doc\":sfdcobj,\n\t\t\t\"boost\":1.0,\n\t\t\t\"overwrite\":true,\n\t\t\t\"commitWithin\":1000\n\t\t}\n\t},\n\t\"url\": \"http://localhost:8983/solr/collection1/update?wt=json\",\n\t\"method\": \"POST\",\n\t\"headers\": {\n    \t\"Content-Type\": \"application/json\"\n    }}\n\n","outputs":1,"x":337.8888854980469,"y":393.6666564941406,"z":"db50bff6.24af4","wires":[["4716a9c6.b8e958"]]},{"id":"bb3e35b0.44c1c8","type":"salesforce in","salesforce":"69a7024d.9658fc","input_type":"StreamingAPI","sobject":"Account","sobject_fields":"Id,Name","soql":"","interval":"10","push_topic":"AllProducts","active":false,"x":99,"y":461,"z":"db50bff6.24af4","wires":[["f203d746.0dfc28"]]},{"id":"d07415f6.2f8be8","type":"inject","name":"Pull Schedule","topic":"topic","payload":"","repeat":"","crontab":"","once":false,"x":129,"y":92,"z":"db50bff6.24af4","wires":[["bd1fe6e9.42e018"]]},{"id":"69c27596.963d8c","type":"mongodb in","mongodb":"8671145b.798ee8","name":"Product Collection","collection":"product","x":456,"y":203,"z":"db50bff6.24af4","wires":[["dd1d861f.22e278"]]},{"id":"bd1fe6e9.42e018","type":"function","name":"Mongo Query All documents","func":"// The received message is stored in 'msg'\n// It will have at least a 'payload' property:\n//   console.log(msg.payload);\n// The 'context' object is available to store state\n// between invocations of the function\n//   context = {};\n\n\nreturn {payload: {}};","outputs":1,"x":207,"y":181,"z":"db50bff6.24af4","wires":[["69c27596.963d8c"]]},{"id":"a57af6a1.5a8508","type":"salesforce out","salesforce":"69a7024d.9658fc","output_type":"upsert","output_sobject":"Product__c","upsert_field":"MongoId__c","x":684,"y":169,"z":"db50bff6.24af4","wires":[[]]},{"id":"dd1d861f.22e278","type":"function","name":"Mongo to salesforce Product Mapping","func":"// The received message is stored in 'msg'\n// It will have at least a 'payload' property:\n//   console.log(msg.payload);\n// The 'context' object is available to store state\n// between invocations of the function\n//   context = {};\n\nvar sfrecs = [];\nfor (var i in msg.payload) {\n\tsfrecs.push ({\n\t   Name: msg.payload[i].Name,\n\t   MongoId__c: msg.payload[i]._id,\n\t   Description__c: \"From Mongo\"\n\t});\n}\n\nreturn {payload: sfrecs};","outputs":1,"x":509,"y":81,"z":"db50bff6.24af4","wires":[["a57af6a1.5a8508"]]}]


Mongo Products

db.product.save([{Name: "Fixed Line 1", Make: "BT", Model: "ISDN123", Description: "Fixed landline & broadband A range of options suitable for medium to large businesses with multiple fixed lines"},{Name: "Fixed Line 2", Make: "BT", Model: "ISDN122", Description: "Fixed landline & broadband A range of options suitable for medium to large businesses with multiple fixed lines"},{Name: "Fixed Line 3", Make: "BT", Model: "ISDN1222", Description: "Fixed landline & broadband A range of options suitable for medium to large businesses with multiple fixed lines"}]);


db.product.remove();


/**** Function Map Mongo to Salesforce  ****/

var sfrecs = [];
for (var i in msg.payload) {
	var sfrec = {}, mrec = msg.payload[i];
	
	for (attr in mrec) {
		if (attr == "_id") {
		   sfrec.MongoId__c = mrec[attr];
		} else if (attr == "Name") {
			sfrec.Name = mrec[attr];
		} else {
		   sfrec[attr+"__c"] = mrec[attr];
		}
	}
	sfrecs.push (sfrec);
}

return {payload: sfrecs};

/***** Map salesforce to Solr ****/
// Map salesforce Product__c schema to Solr Index
var sfdcobj = msg.payload;

// Correct 'Id' to 'id'
sfdcobj.id = sfdcobj.Id;
delete sfdcobj.Id;

// Correct Date Format
sfdcobj.CreatedDate = sfdcobj.CreatedDate.replace(/\+0000/gi, "Z");

// Split Tariff into Array
var code_json = [];
if (sfdcobj.Available_Tariffs__c != null) {
	sfdcobj.Available_Tariffs__c.split(',').forEach(function(c, i) {
		var v1 = c.trim();
		if (v1 != '') code_json.push (v1);
	});
}
sfdcobj.Available_Tariffs__c =  code_json;
					        	
// Solr Body Format
return {
	"payload": {"add":
		{ 	"doc":sfdcobj,
			"boost":1.0,
			"overwrite":true,
			"commitWithin":1000
		}
	},
	"url": "http://localhost:8983/solr/collection1/update?wt=json",
	"method": "POST",
	"headers": {
    	"Content-Type": "application/json"
    }}

