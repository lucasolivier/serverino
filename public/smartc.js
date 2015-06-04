/*----WEBRTC----
-   Verify the RTC protocols each browser uses and check the needs of set protocols contraints like fire fox protocol is by default unreliable
-   Test unreliable transfer to see if it matches with hack to accelerate
-   Test unordered unreliable transfer
-   put time out to kill connection ref in case remote host do not respond
-   think where try blocks should be put
-   check the api events that should be implemented here
-   maybe put a gambiarra that in case some of the browser are chrome, always call is originated from it
-   server may generate a temp key to both connections to them recognize each other thru the identity provider
-   opera browser acts exactly like chrome
--------------*/

var debugging = false;

function isRTCReady() {
    // Chrome or Safari
    if (navigator.webkitGetUserMedia) {
        //getUserMedia = webkitGetUserMedia;
        RTCPeerConnection = webkitRTCPeerConnection;
    }   // Firefox
    else if(navigator.mozGetUserMedia) {
        //getUserMedia = mozGetUserMedia;
        RTCPeerConnection = mozRTCPeerConnection;
        RTCSessionDescription = mozRTCSessionDescription;
        RTCIceCandidate = mozRTCIceCandidate;
    } else
        return false;
    return true;    
}

function SmartRTC(sendDataCallback) {
    
    var self = this;
    
    // This is an optional configuration string associated with NAT traversal setup
    var pcConfig = { iceServers: [ { url: 'stun:stun.l.google.com:19302' } ] };       

    // JavaScript variable associated with proper configuration of an RTCPeerConnection object: use DTLS/SRTP to criptograph data
    var pcConstraints = { optional: [ { DtlsSrtpKeyAgreement: true } ] };
    
    //array to store stabilishing webrtc connections, once it is stabilished, it is dicarded from this array 
    var onGoingConnections = [];  

    this.OnConnection;  //everything will fall here, once a connection is stabilished in both sides
    
    this.OnFailConnection;   //event to be throw if some error ocurrs while trying to stabilish a connection
    
    this.NewConnection = function(targetId) {
        
        //If this Id already got an onGoingConnection ref, do nothing and return
        if(onGoingConnections[targetId])
            return;
    
        //Creates new RTCPeerConnection object with the configuration and constraints speficified
        var peerConnection = new RTCPeerConnection(pcConfig, pcConstraints);
        
        onGoingConnections[targetId] = peerConnection;   //add this new peerConnection to the onGoingConnections array
        
        peerConnection.readyToSendICE = false; //flag to signalize whether this connection can send ICE candidates
        peerConnection.iceToBeSend = [];   //array to store the ice candidates to be send
        
        //Creates dataChannel with the PeerConnection object
        var dataChannel = peerConnection.createDataChannel("dataChannel", { reliable: true });
        
        //Event to be throw once the dataChannel connection is stabilished
        dataChannel.onopen = function() {
            debugLog("Connection opened");

            var newDataChannel = new DataChannel(peerConnection, dataChannel);
            newDataChannel.on("close", function() {
                delete onGoingConnections[targetId];
                debugLog("Connection closed (created)");
            });
            
            self.OnConnection(targetId, newDataChannel);
        };
        
        //Event to be throw once the an ice candidate is found
        peerConnection.onicecandidate = function(event) {   //on get ice candidates, 
            if(peerConnection.readyToSendICE)  //if this connections is ready to send ice candidates,
                sendDataCallback(targetId, { candidate: event.candidate });    //send them 
            else  //if not,      
                peerConnection.iceToBeSend.push(event.candidate);  //store them in a queue to be send once it is ready
        };
        
        //create session descriptor offer and start gathering ice candidates
        peerConnection.createOffer(function(sdpOffer) {
            sdpOffer = hackSDP(sdpOffer);
            peerConnection.setLocalDescription(sdpOffer, function() {
                //must check about the sdp hack to acelerate data speed        
                sendDataCallback(targetId, { offer: sdpOffer });
                debugLog("Local peer sucessfully created.");
            }, onSignalingError);
        }, onSignalingError);
        
    };
    
    this.HandleData = function(senderId, data) {
        debugLog(data);
        //if not valid data, return (null candidate comes when the peer is done with candidates)
        if(!data) return;   
        
        if(data.offer) { //Its a session descriptor offer
                
            if(onGoingConnections[senderId]) {
                //Got to verify whether this connection is currently active instead of verify whether it exists only
                //verify better implementation
                console.log("Connection to this id already been stabilished.");
                return;
            }
                
            var peerConnection = new RTCPeerConnection(pcConfig, pcConstraints);

            onGoingConnections[senderId] = peerConnection;
                
            peerConnection.onicecandidate = function(event) {   //on get ice candidates, 
                sendDataCallback(senderId, { candidate: event.candidate }); 
            };
                
            peerConnection.ondatachannel = function(event) {
                debugLog('Receive Channel Callback: event --> ' + event);
                // Retrieve channel information
                var dataChannel = event.channel;
                dataChannel.onopen = function() { 
                    debugLog("Connection opened");
                    
                    var newDataChannel = new DataChannel(peerConnection, dataChannel);
                    newDataChannel.on("close", function() {
                        delete onGoingConnections[senderId];
                        debugLog("Connection closed (offered)");
                    });
            
                    self.OnConnection(senderId, newDataChannel);
                };                
            };          
                
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer), function() {
                debugLog("Remote descriptor accepted.");             
                peerConnection.createAnswer(function(sdpAnswer) {
                    sdpAnswer = hackSDP(sdpAnswer);
                    peerConnection.setLocalDescription(sdpAnswer, function() {
                        sendDataCallback(senderId, { answer: sdpAnswer });
                        debugLog("Local peer sucessfully created.");
                    }, onSignalingError);
                }, onSignalingError);
            }, onSignalingError);
            
        } else if(data.answer) {   //Its a session descriptor answer
            
            //On sdp answer received, set the remote descriptor
            onGoingConnections[senderId].setRemoteDescription(new RTCSessionDescription(data.answer), function() {
                onGoingConnections[senderId].readyToSendICE = true; //flag the readyToSendICE 
                //iterate thru the iceToBeSend array and send all of them
                while(onGoingConnections[senderId].iceToBeSend.length)
                    sendDataCallback(senderId, { candidate: onGoingConnections[senderId].iceToBeSend.pop() });
                debugLog("Remote descriptor accepted.");    
            }, onSignalingError);
                
        } else if(data.hasOwnProperty("candidate")) { //Its an ice candidate
            if(!data.candidate) //if the candidate is null, return
                return;
            
            onGoingConnections[senderId].addIceCandidate(new RTCIceCandidate(data.candidate), function() {
                debugLog("Ice candidate accepted.");    
            }, onSignalingError);
            
        } else
            console.log("Bad RTC message received.");
    };
    
    function onSignalingError(error) {
        console.log('Failed to create signaling message : ' + error.name);
    }
}



//"Wocket like" wrapper for dataChannel APIs
function DataChannel(peerConnection, dataChannel) {
    
    var self = this;    //holds its own ref
    var events = [];    //events array to store callbacks 
    
    var pConn = peerConnection; //gets peer connection ref to ensure it keeps alive
    
    dataChannel.onerror = function (error) {
       throwError(error);  //throw error methods  
    };
    
    dataChannel.onclose = function () {        
        if(events["close"])
            for(cbIndex in events["close"])   //for each callback in the event array,
                events["close"][cbIndex].call(this); //fire with the args and its scope as "this" value    
    }
    
    dataChannel.onmessage = function (message) {
        //We can't detect msg type due to it comes like general object, only strings comes like "strings"
        //Firefox only see blobs and strings and send blobs
        //Chrome only see ArrayBuffer and strings and can't send blobs
        //Opera acts like chrome

        //check if this is a check an ArrayBuffer and its event is signed (Chrome and Opera)
        if(message.data.byteLength && events["ArrayBuffer"]) {    
            for(cbIndex in events["ArrayBuffer"])   //for each callback in the ArrayBuffer event
                events["ArrayBuffer"][cbIndex].call(this, message.data); //fire with the arrayBuffer data and its scope as "this" value
            return; //do nothing else and return
        }   //if not, check if this is an object, means that is a Blob for (Firefox) and its event is signed
        else if(typeof message.data == "object" && events["Blob"]) { 
            for(cbIndex in events["Blob"])   //for each callback in the ArrayBuffer event
                events["Blob"][cbIndex].call(this, message.data); //fire with the arrayBuffer data and its scope as "this" value
            return; //do nothing else and return
        }
        
        //if it is not of the above, treat them here
        
        var dataObj = getDataObj(message.data);  //get the data obj from the data message received
        
        if(!dataObj.event || dataObj.event == "close" || dataObj.event == "connected" || dataObj.event == "error" || !events[dataObj.event])    
            //verifies whether the dataObj.event is not present, if any of them are protected  and if there is not callback sign with that value
            return; //if so, return
        
        for(cbIndex in events[dataObj.event])   //for each callback in the event array,
            events[dataObj.event][cbIndex].apply(this, dataObj.args); //fire with the args and its scope as "this" value  
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
            if(dataChannel.readyState != "open") //check if the socket is opened
                throw "emitFailedDataChannelNotOpened";  //if not, throw an error socket not open       
            var args = [].slice.call(arguments) // slice without parameters copies all
            var dataObj = { event: args.shift(), args: args };  //create the data object with the data passed           
            dataChannel.send(getDataStr(dataObj));    //send the data string generated from the the dataobj
        } catch(error) {
            throwError(error);  //throw error methods  
        }      
    };
    
    this.sendRaw = function(rawData) {
        try {
            if(dataChannel.readyState != "open") //check if the socket is opened
                throw "sendRawFailedDataChannelNotOpened";  //if not, throw an error socket not open
            dataChannel.send(rawData);    //send the data string generated from the the dataobj
        } catch(error) {
            throwError(error);  //throw error methods  
        } 
    };
    
    this.getReadyState = function() {      
        return dataChannel.readyState;   //return the current state 
    };
    
    this.close = function() {   
        //must verify what else is needed to close the connection
        //and verify if once this method is called, the onclose method is automatically called aswell or we need to force its call
        try {
            peerConnection.close(); //try to close peerConnection,          
        } catch(e) {
            try { dataChannel.close(); } catch(e){}    //if fails, try to close the dataChannel 
        }     
    };   
    
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


function hackSDP(sdp) {

    if (isFirefox) return sdp;
    
    var split = sdp.sdp.split("b=AS:30");
    if(split.length > 1)
        sdp.sdp = split[0] + "b=AS:1638400" + split[1];
    
    return sdp;
}

function debugLog(logMessage) {
    if(debugging) {
        console.log("--DEBUG--");
        console.log(logMessage);
    }
}



