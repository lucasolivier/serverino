module.exports = new IdManager();

function IdManager() {   
    
    var fs = require("fs");
    var Misc = require("./MiscFunctions");
    
    var wordList = [];
    var input = fs.createReadStream("words.txt");
    
    readLines(input, function (data) {
        wordList.push(data);
    });
 
    this.getWordId = function() {
        if(wordList.length == 0)
            return null;
    
        var numberFirst = false;
    
        if(Math.random() > 0.5)
            numberFirst = true;
    
        var numberId = Misc.GetNumId(3);
    
        var wIndex = (Math.random() * wordList.length).toFixed(0);  //got to fix 0 decimal places to use an index
        var wordId = wordList[wIndex];  
    
        wordId = wordId.substr(0,wordId.length-1);
    
        if(numberFirst)
            return numberId+wordId;
        else
            return wordId+numberId; 
    };

    function readLines(input, func) {
        var remaining = '';

        input.on('data', function(data) {
            remaining += data;
            var index = remaining.indexOf('\n');
            while (index > -1) {
                var line = remaining.substring(0, index);
                remaining = remaining.substring(index + 1);
                func(line);
                index = remaining.indexOf('\n');
            }
        });

        input.on('end', function() {
            if (remaining.length > 0) {
                func(remaining);
            }
        });
    }
}