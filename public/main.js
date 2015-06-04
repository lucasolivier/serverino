"use strict"; //ensure exception rise in case of bad pratices use

var sessionAddr = window.location.pathname.substr(1),   //Get sessionAddress from the address bar  
    rtcManager,    
    wSocket, //Instance to have real time connection with the server
    isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1,  
    //verify whether the browser is firefox or other (chrome)
    dChannel;   //var to store the remote peer connection

//--------------  MAIN FUNCTION TO BE EXECUTED TO START EVERYTHING  --------------//

function main() {    
    //Check compatibility, if not, return and inform
    if(!isRTCReady()) {
        alert("Ohh, infelizmente esse browser não é compatível com qeek.me =/");
        return;
    }
    
    document.body.addEventListener("mousemove", function(event) {
        //document.getElementById("macCursor").style.top = event.y +15 + "px";
        //document.getElementById("macCursor").style.left = event.x + 15 + "px";
        
        
        /*document.getElementById("mouseinfo").innerHTML = 
            
            /*event.clientX + "," + event.clientY + "<br>" +
            event.layerX + "," + event.layerY + "<br>" + 
            event.movementX + "," + event.movementY + "<br>" + 
            event.pageX + "," + event.pageY + "<br>" + 
            event.screenX + "," + event.screenY + "<br>" + 
             event.x + "," + event.y+ "<br>" + 
            document.getElementById("macCursor").style.left + "," + document.getElementById("macCursor").style.top +"<br>" +
            document.documentElement.clientHeight + "," + document.documentElement.clientWidth;*/
        
    });
    
    wSocket = new Wocket(); //create new wocket instance
    
    rtcManager = new SmartRTC(function(id, data) {
        wSocket.emit("peerData", id, data); //callback to be use to send signaling data
    });
    
    rtcManager.OnConnection = OnDataChannelConnection;  //callback to be used when a dataChannel is stabilished

    wSocket.on("error", function() {
        alert("Socket Error");     
    });
    
    wSocket.on("connected", function() {
        
        wSocket.on("joinError", function(session) {
            alert("Erro: A sessão '" + session + "' não existe.");
            wSocket.close();    //then, close the connection   
        });
        
        wSocket.on("close", function() {
            alert("Conexão com o servidor perdida =(");
        });

        wSocket.on("sessionJoined", function(session) {
            
            if(session != sessionAddr) {  //if session joined is different from the local one
                alert("Erro: Um erro ocorreu ao entrar na sessão: '" + session);
                wSocket.close();    //then, close the connection
                return; //and return
            }
 
            window.onbeforeunload = function() {
                if(lengthOf(devices)) {
                    return "Hey, sua sessão ainda está ativa!";
                }
            }
            
            log("Conectado!");
        });
        
        wSocket.on("peerClosure", function(closedId) {
            if(dChannel && dChannel.id == closedId) {  //checks if the remoteDevice is been used
                log(closedId + " disconectou."); 
                dChannel.channel.close();
                dChannel = null;
            }        
        });
    
        //CHANGE FOR DEVICE DATA
        wSocket.on("peerData", function(senderId, data) {
            rtcManager.HandleData(senderId, data);    
        });
        
        wSocket.on("NewDevice", function(dId) {
            if(dChannel)    //if the data channel is already been in use
                return; //do nothing and returns
            
            dChannel = {
                id: dId
            };
            
            log("Novo dispositivo! Conectando....");
            rtcManager.NewConnection(dId);  //create new connection to this id 
        });       
        
        wSocket.emit("joinSession", sessionAddr);
    });
    
    wSocket.on("peerDataError", function(destId, data) {
        alert("Erro: Erro ao enviar os dados =(");
    });
    
    //All set, connect websocket
    log("Conectando...");

    wSocket.connect("ws://" + window.location.host);
}

function OnDataChannelConnection(id, dataChannel) {
    
    if(!dChannel) {
        dChannel = {
            id: id,           
        };
    } else if(dChannel && (dChannel.id != id || dChannel.channel)) {
        alert("Um erro ocorreu enquanto a conexão era gerada.");
    }
    
    dChannel.channel = dataChannel;
    
    dataChannel.on("error", function(err) {
        log(err);    
    });
        
    dataChannel.on("ArrayBuffer", function(data) {
        log("Array Buffer Received"); 
    });
        
    dataChannel.on("Blob", function(data) {
        log("Blob received");  
        var fileReader = new FileReader();
        fileReader.onload = function() {
            //this.result variable is and arrayBuffer

        };
        fileReader.readAsArrayBuffer(data);
        return; 
    });
        
    dataChannel.on("close", function() {
        log("DataChannel closed.");
    });
    
    log("Data Channel estabelecido!");
}

function log(message) {
    console.log(message);
}


