function getConfiguration() 
{
	var modules = [];
    modules.push({"name": "Input", "configuration": 
    	{
    		"layout": {
    			"width": (window.parent.innerWidth-20) * 0.38,
    			"height": 180,
    			"posx": 0,
    			"posy": 0
    		},

    		"title": "Input Clafer Model and Options",
    		"optimization_backend": false, 
            "input_default_cache": "checked",
            "input_default_flags": "",
            "file_extensions": [
                {
                    "ext": ".cfr", 
                    "button_file_caption": "Configure",
                    "button_example_caption": "Configure",
                    "button_editor_caption": "Configure",

                    "button_file_tooltip": "Configure tooltip",
                    "button_example_tooltip": "Configure tooltip",
                    "button_editor_tooltip": "Configure tooltip"
                }
            ],

            "onError": function(module, statusText, response, xhr){
                var caption = "";
                if (statusText == "compile_error")
                    caption = "<b>Compile Error.</b><br>Please check whether Clafer Compiler is available, and the model is correct.";
                else if (statusText == "timeout")
                    caption = "<b>Request Timeout.</b><br>Please check whether the server is available.";
            //    else if (statusText == "malformed_output")
            //        caption = "<b>Malformed output received from ClaferMoo.</b><br>Please check whether you are using the correct version of ClaferMoo. Also, an unhandled exception is possible.  Please verify your input file: check syntax and integer ranges.";        
            //    else if (statusText == "malformed_instance")
            //        caption = "<b>Malformed instance data received from ClaferMoo.</b><br>An unhandled exception may have occured during ClaferMoo execution. Please verify your input file: check syntax and integer ranges.";        
            //    else if (statusText == "empty_instances")
            //        caption = "<b>No instances returned.</b>Possible reasons:<br><ul><li>No optimal instances, all variants are non-optimal.</li><li>An unhandled exception occured during ClaferMoo execution. Please verify your input file: check syntax and integer ranges.</li></ul>.";        
            //    else if (statusText == "empty_argument")
            //        caption = "<b>Empty argument given to processToolResult.</b><br>Please report this error.";        
            //    else if (statusText == "empty_instance_file")
            //        caption = "<b>No instances found in the specified file.";        
            //    else if (statusText == "optimize_first")
            //        caption = "<b>You have to run optimization first, and only then add instances.";        
                else if (statusText == "error" && response.responseText == "")
                    caption = "<b>Request Error.</b><br>Please check whether the server is available.";        
                else
                    caption = '<b>' + xhr + '</b><br>' + response.responseText.replace("\n", "<br>");

                return caption;

            },

            "onBeginQuery": function(module)
            {
                if (module.host.findModule("mdControl").sessionActive) // if there is an active IG session
                {
                    alert("Please stop the instance generator and save your results first");
                    return false;
                }

                module.host.findModule("mdControl").disableAll();
    
                module.host.storage.worker = new Worker(module.host); // creating a class for working with instances             

                return true;
            },

            "onFileSent": function(module){
                module.host.print("ClaferIDE> Processing the submitted model. Compiling...\n");
            },

            "onPoll" : function(module, responseObject){
                if (responseObject.args)
                {
                    module.host.print("ClaferIDE> clafer " + responseObject.args + "\n");
                }
            },
            "onCompleted" : function(module, responseObject){               
                if (responseObject.model != "")
                {
                    module.editor.getSession().setValue(responseObject.model);
                }

                if (responseObject.compiled_formats)
                {
                    for (var i = 0; i < responseObject.compiled_formats.length; i++)
                    {
                        if (responseObject.compiled_formats[i].id == "xml")
                        {
                            var xml = responseObject.compiled_formats[i].result;

                            xml = convertHtmlTags(xml);

                            xml = xml.replaceAll('<?xml version="1.0"?>', '');
                            xml = xml.replaceAll(' xmlns="http://clafer.org/ir" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:cl="http://clafer.org/ir" xsi:schemalocation="http://clafer.org/ir https://github.com/gsdlab/clafer/blob/master/src/ClaferIR.xsd"', '');
                            xml = xml.replaceAll('cl:', '');
                            xml = xml.replaceAll('xsi:', '');

                            module.host.storage.worker.data.claferXML = xml;
                            break;
                        }                        
                    }
                }                

                if (responseObject.qualities)
                {
                    module.host.storage.worker.data.qualities = qualities;    
                }                

                module.host.print("Compiler> " + responseObject.message + "\n");
                module.host.print(responseObject.compiler_message + "\n");    

                if (responseObject.message == "Success")
                {
                    module.host.findModule("mdControl").resetControls();
                }
                else
                {
                    module.host.findModule("mdControl").disableAll(); // if exited IG, then disable controls
                }                 

                return true;   
    		}    		
    	}
	});
    
    modules.push({"name": "Output", "configuration": 
    	{
	    	"title": "Output",

            "layout": {
                "width": (window.parent.innerWidth+65) * 0.38,
                "height": 180,
                "posx": (window.parent.innerWidth-40) * (1 - 0.38),
                "posy": 0
            }

    	}});


    modules.push({"name": "Control", "configuration": 
    {
            "layout": {
                "width": (window.parent.innerWidth-40) * (0.24),
                "height": 180,
                "posx": (window.parent.innerWidth-40) * 0.38,
                "posy": 0
            },
            "title": "Instance Generator",
            "onError": function(module, statusText, response, xhr)
            {
                if (statusText == "timeout")
                    caption = "<b>Request Timeout.</b><br>Please check whether the server is available.";
                else if (response && response.responseText == "process_not_found")
                    caption = "<b>Session not found.</b><br>Looks like your session has been closed due to inactivity. Please recompile your model to start a new session";
                else if (statusText == "error" && response.responseText == "")
                    caption = "<b>Request Error.</b><br>Please check whether the server is available.";        
                else
                    caption = '<b>' + xhr + '</b><br>' + response.responseText.replace("\n", "<br>");   

                return caption;     
            },
            "onStarted": function (module)
            {
                module.host.print("ClaferIDE> Running the chosen instance generator...\n");            
                module.host.storage.worker.initializeGeneration(1); 
            },
            "onStopped": function (module)
            {
                module.host.print("ClaferIDE> Forcing the instance generator to close...\n");               
            },
            "onGlobalScopeSet": function (module)
            {
                module.host.print("ClaferIDE> Setting the global scope...\n");
            },
            "onClaferScopeSet": function (module)
            {
                module.host.print("ClaferIDE> Setting the individual scope...\n");
            },
            "onIntScopeSet": function (module)
            {
                module.host.print("ClaferIDE> Setting integer bounds...\n");
            },          
            "onBitwidthSet": function (module)
            {
                module.host.print("ClaferIDE> Setting the bitwidth...\n");
            },          
            "onPoll" : function(module, responseObject){
                module.host.storage.worker.processIGOutput(responseObject);
            },
            "onCompleted": function (module, responseObject){
                module.host.print("ClaferIDE> The instance generator is exited.\n");
            },
            "onBackendChange": function (module, newBackendId)
            {
                module.host.storage.backendId = newBackendId;
                $("#instancesToGet").remove();
                $("#" + newBackendId + "_buttons").prepend('<input class="scopeInput" type="text" value="10" name="instancesToGet" id="instancesToGet"/>');
                
                if (module.host.storage.worker)
                {
                    module.host.storage.worker.selectedBackendId = newBackendId;
                }
            },
            "onControlButtonClick": function(module, id)
            {
                if (id.indexOf("next_instance") != -1) // it's a next instance button
                {
                    module.host.storage.worker.initializeGeneration(0);   
                }
            }    

        }});

    modules.push({"name": "FeatureQualityMatrix", "configuration": 
        {
            "title": "Feature and Quality Matrix",

            "layout": {
                "width": window.parent.innerWidth - 20 - 230,
                "height": window.parent.innerHeight - 60 - 220,
                "posx": 0,
                "posy": 220
            },

            "buttonsForRemoval": true,
            "instancesSelectable": false,

            "onReset": function(module)
            {
                var constraintModule = module.host.findModule("mdConstraints");
                constraintModule.reset();
            },
            "onFeatureExpanded": function(module, feature)
            {
            },
            "onFeatureCollapsed": function(module, feature)
            {
            },          
            "onFeatureCheckedStateChange": function(module, feature, require)
            {
                var constraintModule = module.host.findModule("mdConstraints");

                if (require == 1){
                    constraintModule.addConstraint(feature, true);
                } else if (require == 0){
                    constraintModule.removeConstraint(feature);
                } else if (require == -1){
                    constraintModule.addConstraint(feature, false);
                } else {
                    alert("an error occured while adding a constraint");
                }
            },
            "onInstanceRemove" : function(module, num)
            {
            }
        }});

    modules.push({"name": "ConstraintManipulator", "configuration": 
        {
            "title": "Constraints",

            "layout": {
                "width": 250,
                "height": window.parent.innerHeight - 60 - 220,
                "posx": window.parent.innerWidth - 20 - 230,
                "posy": 220
            }
        }});

    var settings = {
    	"onInitialize": function(host)
	    {
	    },
    	"onLoaded": function(host)
	    {
            $('#ControlForm').prepend('<input type="hidden" name="instanceGenerationState" id="instanceGenerationState" value="none"/>');
 	    	$("#myform").submit();
	    }	    
	};

    return {"modules": modules, "settings": settings};
}