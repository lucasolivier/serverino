function getIndexOf(data, character) {
    var indexList = [];    
    var currIndex = data.indexOf(character);    
    if(currIndex == -1)
        return indexList;   
    indexList[indexList.length] = currIndex;   
    while(true) {        
        currIndex = data.indexOf(character, currIndex + 1);      
        if(currIndex == -1)
            break;           
        indexList[indexList.length] = currIndex;
    }    
    return indexList; 
}

function lengthOf(obj) {
    var c=0;
    for(var fieldName in obj)
        c++;
    return c;
}

function getTimeStamp() {
    var cTime = new Date();
    return (cTime.getHours()<10?"0"+cTime.getHours():cTime.getHours()) + ":" + (cTime.getMinutes()<10?"0"+cTime.getMinutes():cTime.getMinutes());  
}