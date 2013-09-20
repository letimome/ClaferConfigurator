/*
Copyright (C) 2012 Neil Redman <http://gsd.uwaterloo.ca>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var http = require("http");
var url = require("url");
var sys = require("sys");
var fs = require("fs");
var path = require('path');
var express = require('express');
var config = require('./config.json');

processes = [];

var port = config.port;

var toolpath = __dirname + "/claferIG/claferIG"

var server = express();
server.use(express.cookieParser('82398sdflkjasoi920932'));
server.use(express.static(__dirname + '/Client'));
server.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + '/uploads' }));

server.get('/', function(req, res) {
	res.sendfile("Client/app.html");
});

server.post('/close', function(req, res){
	closeProcess(req.body.windowKey)
});

server.post('/uploads', function(req, res){
	//close any pervious processes
	closeProcess(req.body.windowKey)

	var resEnded = false;
	//check to see if clafer file was subbmited
	if (req.files.claferFile === undefined){
		res.send("no clafer file submitted");
	} else {
		var upFilePath = req.files.claferFile.path;
	}

	//make temp folder for files and move file there
	var i = 0;
	while(fs.existsSync("./uploads/" + i + "tempfolder/")){
		i++;
	}
	var pathTokens = "." + upFilePath.split("Server")[1];
	pathTokens = pathTokens.split("/");
	var oldPath = upFilePath
	var upFilePath = __dirname + "/" + pathTokens[1] + "/" + i + "tempfolder/";
	fs.mkdir(upFilePath, function (err){
		if (err) throw err;
		var dlDir = upFilePath;
		upFilePath += pathTokens[2];
		console.log("moving file from" + oldPath + " to " + upFilePath);
		fs.rename(oldPath, upFilePath, function (err){
			if (err) throw err;
			//extract quality attributes
			var content = (fs.readFileSync(upFilePath)).toString();
			content = content.split("\n");
			var qualities = "";
			for (i=0; i<content.length; i++){
				if (content[i].indexOf("//# QUALITY_ATTRIBUTE") != -1)
					qualities += content[i].replace(/[ ]{1,}/, "").replace("//# QUALITY_ATTRIBUTE", "") + "\n";
			}

			//proccess file
			console.log("proceeding with " + upFilePath);
			var util  = require('util');
			spawn = require('child_process').spawn;
			var claferXML = "";
			claferCall = spawn("clafer",[upFilePath, '--mode=xml', "-o", "--skip-goals", "--check-afm"]);
			claferCall.stdout.on("data", function (data){
				claferXML += data;
			});
			claferCall.on("close", function (code){
//				console.log("first call complete");
				if (code != 0){
					res.writeHead(400, { "Content-Type": "text/html"});
					res.end("Error compiling the model. Make sure your model is a correct 'attributed feature model with inheritance'.");
				}
				else {
					var d = new Date();
					var obj = { windowKey: req.body.windowKey, tool: null, freshData: "", folder: dlDir, file: upFilePath, lastUsed: d, error: ""};
					if (req.body.bitwidth != ""){
						var args = [upFilePath, "--bitwidth=" + req.body.bitwidth, "--useuids", "--addtypes"];
					} else {
						var args = [upFilePath, "--useuids", "--addtypes"];
					}
	//				console.log(args);
					tool = spawn("claferIG", args);
					obj.tool = tool;
					processes.push(obj);
					tool.stdout.on("data", function (data){
		//				console.log("/*****************\nGetting data\n*************/")
						for (var i = 0; i<processes.length; i++){
		//					console.log(processes.length)
		//					console.log(i);
		//					console.log("stuck in post loop")
							if (processes[i].windowKey == req.body.windowKey){
								if (!resEnded){
									claferXML = claferXML.replace(/[^<]{1,}/m, '');
	//									console.log(claferXML)
									res.writeHead(200, { "Content-Type": "text/html"});
									res.end(claferXML + "=====" + data + "=====" + qualities);
									resEnded = true;
								} else{
									processes[i].freshData += data;
								}
							}
						}
					});
					tool.stderr.on("data", function (data){
						for (var i = 0; i<processes.length; i++){
		//					console.log(processes.length)
		//					console.log(i);
							if (processes[i].windowKey == req.body.windowKey){
								if (!resEnded){
									res.writeHead(200, { "Content-Type": "text/html"});
									claferXML = claferXML.replace(/[^<]{1,}/m, '');
									res.end(claferXML + "=====" + data);
									resEnded = true;
								} else{
									processes[i].error += data;
								}
							}
						}
					});
					tool.on("close", function(){
						for (var i = 0; i<processes.length; i++){
							if (processes[i].windowKey == req.body.windowKey){
								console.log(processes[i].error)
								cleanupOldFiles(processes[i].folder);
								processes.splice(i, 1);
								if (!resEnded){
									res.writeHead(400, { "Content-Type": "text/html"});
									res.end(processes[i].error)
								}	
							}
						}
					});
				}
			});
		});
	});
});

server.get('/Control', function(req, res){
	console.log("Request for new instance")
	var resEnd = false;
	for (var y = 0; y<this.processes.length; y++){
		if (processes[y].windowKey == req.query.windowKey){
			processes[y].tool.stdout.removeAllListeners("data");
			var d = new Date();
			processes[y].lastUsed = d;
			var CurProcess = processes[y];
			if (req.query.operation == "next"){
				CurProcess.tool.stdin.write("n\n", function(){
					CurProcess.tool.stdout.on("data", function (data){
						if (!resEnd){	
							res.writeHead(200, { "Content-Type": "text/html"});
							res.end(data + "\n=====\n" + processes[y].error);
							processes[y].error = "";
							resEnd = true;
						}
						CurProcess.tool.stdout.removeAllListeners("data");
					});	
				});
				break;
			} else if (req.query.operation == "scope"){
				console.log("i " + req.query.superClafer + " " + req.query.increaseScopeBy + "\n");
				CurProcess.tool.stdin.write("i " + req.query.superClafer + " " + req.query.increaseScopeBy + "\n", function(){
					CurProcess.tool.stdout.on("data", function (data){
						if (!resEnd){	
							res.writeHead(200, { "Content-Type": "text/html"});
							res.end(data);
							resEnd = true;
						}
						CurProcess.tool.stdout.removeAllListeners("data");
					});	
				});
			break;
			}

		}
	}
});

server.get("/unsatisfiable", function(req, res){
	console.log("asked for unsat");
	for (var i = 0; i<processes.length; i++){
		if (processes[i].windowKey == req.query.windowKey){
			console.log("sending unsat");
			res.writeHead(200, { "Content-Type": "text/html"});
			console.log(processes[i].error + processes[i].freshData)
			res.end(processes[i].error + "=====\n" + processes[i].freshData)
		}
	}
});


function closeProcess(Key){
	for (var y = 0; y<this.processes.length; y++){
		if (processes[y].windowKey == Key){
			console.log("closing process");
			var toDelete = processes[y];
			toDelete.tool.removeAllListeners("close");
			toDelete.tool.stdin.write("q\n");
			cleanupOldFiles(toDelete.folder);
			processes.splice(y, 1);
		}
	}
}

function finishCleanup(dir, results){
	if (fs.existsSync(dir)){
		fs.rmdir(dir, function (err) {
  			if (err) throw err;
 			console.log("successfully deleted " + dir + " along with contents:\n" + results);
		});
	}
}
 
function cleanupOldFiles(dir) {

	//cleanup old files
	fs.readdir(dir, function(err, files){
		if (err) throw err;
		var results = "";
		var numFiles = files.length;
		console.log("#files = " + numFiles);
		if (!numFiles){
			return finishCleanup(dir, results);
		} else {
			files.forEach(function(file){
				deleteOld(dir + "/" + file);
				results += file + "\n";
			});	
			finishCleanup(dir, results);
		}
	});


//done cleanup
}

function deleteOld(path){
	if (fs.existsSync(path)){
		fs.unlink(path, function (err) {
			if (err) throw err;
		});
	}
}

function ProcessCleaner(){
	var Cleaner = setInterval(function(){
		for (var i = 0; i<processes.length; i++){
			var d = new Date();
			if((d-processes[i].lastUsed)>config.processTimeout){
				closeProcess(processes[i].windowKey);
			}
		}
	}, config.processTimeout);
}

function ProcessLog(){
	var log = setInterval(function(){
		console.log(processes);
	}, 10000);
}

/*
 * Catch all. error reporting for unknown routes
 */
server.use(function(req, res, next){
  res.send(404, "Sorry can't find that!");
});

var dependency_count = 3; // the number of tools to be checked before the Visualizer starts
console.log('=========================================');
console.log('| Clafer Configurator v0.3.4.20-9-2013  |');
console.log('=========================================');
var spawn = require('child_process').spawn;
console.log('Checking dependencies...');

var clafer_compiler  = spawn("clafer", ["-V"]);
var clafer_compiler_version = "";
clafer_compiler.on('error', function (err){
    console.log('ERROR: Cannot find Clafer Compiler (clafer). Please check whether it is installed and accessible.');
});
clafer_compiler.stdout.on('data', function (data){	
    clafer_compiler_version += data;
});
clafer_compiler.on('exit', function (code){	
    console.log(clafer_compiler_version.trim());
    if (code == 0) dependency_ok();
});

var clafer_ig  = spawn("claferIG", ["-V"]);
var clafer_ig_version = "";
clafer_ig.on('error', function (err){
    console.log('ERROR: Cannot find Clafer Instance Generator (claferIG). Please check whether it is installed and accessible.');
});
clafer_ig.stdout.on('data', function (data){	
    clafer_ig_version += data;
});
clafer_ig.on('exit', function (code){	
    console.log(clafer_ig_version.trim());
    if (code == 0) dependency_ok();
});

var java  = spawn("java", ["-version"]);
var java_version = "";
java.on('error', function (err){
    console.log('ERROR: Cannot find Java (java). Please check whether it is installed and accessible.');
});
java.stdout.on('data', function (data){	
    java_version += data;
});
java.stderr.on('data', function (data){	
    java_version += data;
});
java.on('exit', function (code){	
    console.log(java_version.trim());
    if (code == 0) dependency_ok();
});

var node_version = process.version + ", " + JSON.stringify(process.versions);
console.log("Node.JS: " + node_version);

function dependency_ok()
{
    dependency_count--;
    if (dependency_count == 0)
    {
        server.listen(port);
        ProcessCleaner();
        console.log('Dependencies found successfully. Please review their versions manually');        
        console.log('======================================');
        console.log('Ready. Listening on port ' + port);        
    }
}

var getkeys = function(obj){
		var keys = [];
		for(var key in obj){
			keys.push(key);
		}
		return keys;
}
