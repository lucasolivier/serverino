//Wocket is a class to wrap and handle websocket information

try {
    module.exports = Wocket; //to be used in node.js for export
} catch(e){}

function Wocket(wSocket) {   
    
    var self = this;    //holds its own ref
    var events = [];    //events array to store callbacks     
    
    if(!wSocket) {    //if not specified, so its client side
        this.connect = function(serverAddr) {   //creates connect method           
            try {
                wSocket = new WebSocket(serverAddr);    //creates new websocket with the address to connect to
                
                self.ws = wSocket;  //get websocket reference
                
                //inits the websocket events only after the object has been created
                wSocket.onopen = function() {   //sign the open event as connected
                    if(events["connected"])
                        for(cbIndex in events["connected"])   //for each callback in the event array,
                            events["connected"][cbIndex].call(this); //fire with the args and its scope as "this" value     
                };                
                
                wSocket.onerror = eventOnError;
    
                wSocket.onclose = eventOnClose;
    
                wSocket.onmessage = eventOnMessage;
                
            } catch(error) {
                throwError(error);  //throw error methods  
            }            
        };   
    } else {    //if it is specified it is server side
        
        self.ws = wSocket;  //get websocket reference
        
        self.getIpv4 = function () {    //get the connection ipv4
            var ipCollection = self.ws.upgradeReq.connection.remoteAddress;
            return ipCollection.substr(ipCollection.lastIndexOf(":") + 1);    
        };
        
        //inits the websocket events
        wSocket.onerror = eventOnError; 
    
        wSocket.onclose = eventOnClose;
    
        wSocket.onmessage = eventOnMessage;  
    }
    
    this.on = function(event, callback) {   //sign callback event
        if(!events[event])  //if the event specified is still empty
            events[event] = []; // Inits the event name           
        events[event].push(callback);   //push the callback to the array        
    };

    this.clear = function(event, position) {
        if(!events[event])  //if the event is not signed, return
            return;
        if(!position)   //if the position is not specified, clear all
            events[event] = null;
        else
            events[event][position] = null; //clear the event callback position       
    };
    
    this.emit = function(event) {
        try {    
            //this is needed due to send while not connected do not throw exceptions
            if(wSocket.readyState != 1) //check if the socket is opened
                throw "emitFailedSocketNotOpen";  //if not, throw an error socket not open       
            var args = [].slice.call(arguments) // slice without parameters copies all
            var dataObj = { event: args.shift(), args: args };  //create the data object with the data passed           
            wSocket.send(getDataStr(dataObj));    //send the data string generated from the the dataobj
        }
        catch(error) {
            throwError(error);  //throw error methods  
        }      
    }; 
    
    this.getReadyState = function() {
        if(!wSocket)    //If the socket has not been initiated,
            return 2;   //return CLOSED state
        else    //if it has,        
            return wSocket.readyState();   //return the current state 
    };
    
    this.close = function() {   
        //must verify what else is needed to close the connection
        //and verify if once this method is called, the onclose method is automatically called aswell or we need to force its call
        
        if(wSocket.readyState == 1) //if it is connected
            wSocket.close();     //close the socket connection          
    };   
    
    function eventOnMessage(message) {
        var dataObj = getDataObj(message.data);  //get the data obj from the data message received    
        
        if(!dataObj.event || dataObj.event == "close" || dataObj.event == "connected" || dataObj.event == "error" || !events[dataObj.event])    
            //verifies whether the dataObj.event is not present, if any of them are protected  and if there is not callback sign with that value
            return; //if so, return
        
        for(cbIndex in events[dataObj.event])   //for each callback in the event array,
            events[dataObj.event][cbIndex].apply(this, dataObj.args); //fire with the args and its scope as "this" value  
    }
    
    function eventOnClose(code, message) {
        if(events["close"])
            for(cbIndex in events["close"])   //for each callback in the event array,
                events["close"][cbIndex].call(this, code, message); //fire with the args and its scope as "this" value    
    }
    
    function eventOnError(error) {
       throwError(error);  //throw error methods  
    }   
    
    function throwError(error) {
        if(events["error"])
            for(cbIndex in events["error"])   //for each callback in the event array,
                events["error"][cbIndex].call(this, error); //fire with the args and its scope as "this" value         
    }
    
    function getDataStr(dataObj) {
        return JSON.stringify(dataObj);
    }

    function getDataObj(dataStr) {
        return JSON.parse(dataStr);
    }
}