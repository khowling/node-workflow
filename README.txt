

A exciting project using node-red,  I've built a salesforce adapter!

Example worksheet

[{"id":"8671145b.798ee8","type":"mongodb","hostname":"127.0.0.1","port":"27017","db":"test","name":"Mongo Local Test Database"},{"id":"e204545a.1dfba8","type":"salesforce in","salesforce":"","input_type":"StreamingAPI","sobject":"","sobject_fields":"","soql":"","interval":"10","push_topic":"AllProducts","active":true,"x":111,"y":115,"z":"15447096.eabb8f","wires":[["20ecc751.df1338"]]},{"id":"a49a626f.5b65a","type":"http request","name":"","method":"GET","url":"","x":421,"y":83,"z":"15447096.eabb8f","wires":[[]]},{"id":"20ecc751.df1338","type":"function","name":"SFDC to Heroku SOLR","func":"// Map salesforce Product__c schema to Solr Index\nvar sfdcobj = msg.payload;\n\n// Correct 'Id' to 'id'\nsfdcobj.id = sfdcobj.Id;\ndelete sfdcobj.Id;\n\n// Correct Date Format\nsfdcobj.CreatedDate = sfdcobj.CreatedDate.replace(/\\+0000/gi, \"Z\");\n\n// Split Tariff into Array\nvar code_json = [];\nif (sfdcobj.Available_Tariffs__c != null) {\n\tsfdcobj.Available_Tariffs__c.split(',').forEach(function(c, i) {\n\t\tvar v1 = c.trim();\n\t\tif (v1 != '') code_json.push (v1);\n\t});\n}\nsfdcobj.Available_Tariffs__c =  code_json;\n\t\t\t\t\t        \t\n// Solr Body Format\nreturn {\n\t\"payload\": {\"add\":\n\t\t{ \t\"doc\":sfdcobj,\n\t\t\t\"boost\":1.0,\n\t\t\t\"overwrite\":true,\n\t\t\t\"commitWithin\":1000\n\t\t}\n\t},\n\t\"url\": \"http://localhost:8983/solr/collection1/update?wt=json\",\n\t\"method\": \"POST\",\n\t\"headers\": {\n    \t\"Content-Type\": \"application/json\"\n    }}\n\n","outputs":1,"x":292,"y":167,"z":"15447096.eabb8f","wires":[["a49a626f.5b65a"]]},{"id":"e5c863a6.1a37a","type":"mongodb in","mongodb":"8671145b.798ee8","name":"Mongo find Product","collection":"product","x":260,"y":345,"z":"15447096.eabb8f","wires":[["3db551a9.c24aae"]]},{"id":"c01e0336.3fe2","type":"function","name":"Mongo Query All documents","func":"// The received message is stored in 'msg'\n// It will have at least a 'payload' property:\n//   console.log(msg.payload);\n// The 'context' object is available to store state\n// between invocations of the function\n//   context = {};\n\n\nreturn {payload: {}};","outputs":1,"x":185,"y":281,"z":"15447096.eabb8f","wires":[["e5c863a6.1a37a"]]},{"id":"4436cd76.bbc934","type":"inject","name":"","topic":"","payload":"","repeat":"","crontab":"","once":true,"x":91,"y":234,"z":"15447096.eabb8f","wires":[["c01e0336.3fe2"]]},{"id":"3db551a9.c24aae","type":"function","name":"Mongo to salesforce Product Mapping","func":"// outputs: 1\nvar sfrecs = [];\nfor (var i in msg.payload) {\n\tvar sfrec = {}, mrec = msg.payload[i];\n\t\n\tfor (attr in mrec) {\n\t\tif (attr == \"_id\") {\n\t\t   sfrec.MongoId__c = mrec[attr];\n\t\t} else if (attr == \"Name\") {\n\t\t\tsfrec.Name = mrec[attr];\n\t\t} else {\n\t\t   sfrec[attr+\"__c\"] = mrec[attr];\n\t\t}\n\t}\n\tsfrecs.push (sfrec);\n}\n\nreturn {payload: sfrecs};","outputs":1,"x":272,"y":408,"z":"15447096.eabb8f","wires":[[]]}]

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

