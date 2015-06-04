//--------------------  SERVERINO --------------------//

//GET ALL EXTERNAL MODULES
var cfenv = require("cfenv"),   //get cloud foundry enviroment module
    http  = require("http"),    //get http module
    ws = require("ws"), //get the websocket module
    express = require("express"),   //get express module
    Wocket = require("./Wocket"),  //Import MaestroSocket class from MaestroSocket.js
    IdManager = require("./IdManager"), //get IdManager module
    Misc = require("./MiscFunctions"),  //Import MiscFunctions class from MiscFunctions.js 

//INIT MODULES
    appEnv = cfenv.getAppEnv(),   // get environmental information for this app
    app = express(),    //inits the express application
    httpServer = http.createServer(app),// create a server with a simple request handler
    wsServer = new ws.Server({ server: httpServer }); //'promotes' the httpserver to a websocket server


//------------------------------------------------------------------------------------//

//SERVE HTTP FILES IN PUBLIC FOLDERS
app.use(express.static("public"));  
    
//CREATE NEW SESSION AND RESPOND GET/ WITH THE SESSION CREATED
app.get("/", function(req, res) {
    var newSession = createSession();
    //timeout in case no one connects to it until one minute, it will be cleared
    setTimeout(function() { 
        if(Misc.LengthOf(sessions[newSession]) <= 0) {
            log("Deleting abandoned session.");
            delete sessions[newSession]; 
        } 
    }, 60000);
    log("New session created: " + newSession);    
    //res.redirect("https://b.qeek.me/" + newSession);
    res.redirect(newSession);
});

//CHECK IF THE REQUESTED GET/* PATH EXISTS, IF SO, RETURN INDEX, IF NOT, RETURN ERROR     
app.get("/*", function(req, res) {  
    //CHECK REQUESTED GET
    
    if(req.path.indexOf(".") > -1) {//if any dot is found, 
        res.end();  //finish the response      
    } else if(req.path == "/getSystemStatus") {
        var statusWord = "<html>Status:<br>Sessions: " + Misc.LengthOf(sessions);

        for(s in sessions)
           statusWord += "<br><br>" + s; 
        res.send(statusWord);
        //res.send("<html>Status:<br>Sessions: " + Misc.LengthOf(sessions));
    } else if(sessions[req.path.substr(1)])   //if the session exists
        res.sendFile(__dirname + "/public/session.html");   //return the session.html
    else //if it falls here, send a not found
        res.send("Not Found");
});

//-----------------------------------------------

var sessions = [];

wsServer.on("connection", function(sock) {
    
    log("New connection.");
    
    wSocket = new Wocket(sock);
    
    wSocket.on("error", function() {
        log("Websocket error.");    
    });
    
    wSocket.on("joinSession", function(sessionAddr) {
    //generate timeout in case information is not send by connected client
                
        var connId;  //var to store this connection id
        
        if(!sessions[sessionAddr]) {
            wSocket.emit("joinError", sessionAddr);
            log("Session join error");
            wSocket.close();
            return;   
        }
        
        //CREATE NEW CONNECTION ID
        //Keeps generating 20 chars id until a not used is found
        //Try to find away to lock sessions array to ensure not equal id is got
        do {
            connId = Misc.GetAlphaNumId(20);    
        } while(sessions[sessionAddr][connId]);
                 
        sessions[sessionAddr][connId] = wSocket;    //Join session
        
        wSocket.connId = connId;    //gets the connection id

        log("New client ID: " + connId);
        
        //Set connection sucessfull events....
        
        //On peer data...
        wSocket.on("peerData", function(destId, data) {        
            
           if(sessions[sessionAddr][destId])  //if not, check if the destination id belong to session address
                sessions[sessionAddr][destId].emit("peerData", connId, data);   
            else    //if not, send the sender an error message due to destination not found
                wSocket.emit("peerDataError", destId, data);
        });  
          
        //On connection close...
        wSocket.on("close", function() {                    
           if(sessions[sessionAddr][connId])    //Check if this connection belong to the session address
                delete sessions[sessionAddr][connId];  //if so, delete it        
            log("Client " + connId + " disconnected.");
            log("Session Address members: " + Misc.LengthOf(sessions[sessionAddr]));
            
            //Check if the session is empty, if so, delete it, if not inform members this connection is closed
            if(Misc.LengthOf(sessions[sessionAddr]) <= 0) {
                log("Deleting empty session.");
                delete sessions[sessionAddr];          
            } else {
                log("Informing session this connection is closed...");
                for(var id in sessions[sessionAddr])
                    sessions[sessionAddr][id].emit("peerClosure", connId);
                log("All members of the session have been informed.");
            }
        });            
        
        //Everything is set, inform the connection it has joined
        wSocket.emit("sessionJoined", sessionAddr);
        
        //Iterate thru the session address...
        for(id in sessions[sessionAddr]) {
            if(id == connId)    //ensure to not send information to connection itself
                continue;          
            //inform current id this device connection (took out to do not fall into two peers trying to connect at same time
            //sessions[sessionAddr][id].emit("NewDevice", connId);   
            //inform this connection, the current device
            sessions[sessionAddr][connId].emit("NewDevice", id);
        }
    });
});

// Everything is set, start listening Connections
httpServer.listen(appEnv.port, function() {
    console.log("Server starting on " + appEnv.url)
})


function createSession() {
    
    do {
        var newSessionId = IdManager.getWordId();       
    } while(sessions[newSessionId]);
             
    sessions[newSessionId] = [];
    
    return newSessionId;
}

function getDataStr(dataObj) {
    return JSON.stringify(dataObj);
}

function getDataObj(dataStr) {
    return JSON.parse(dataStr);
}
    
function log(string){   //wrap for log info into the console
    cTime = new Date();
    console.log(Misc.GetTimeStamp() + " " + string);
}


    
    

