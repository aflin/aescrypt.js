/* ********************************************************************************
	MIT license.

	Copyright 2017 Aaron Flin

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to
	deal in the Software without restriction, including without limitation the
	rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
	sell copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in
	all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
	FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
	IN THE SOFTWARE.

	------------------------------------------------------------------------------
*/
// toType() credit to:
// https://javascriptweblog.wordpress.com/2011/08/08/fixing-the-javascript-typeof-operator/ but added 0-9 so it gets Uint8Array
var toType = function(obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z0-9]+)/)[1].toLowerCase();
}

// Takes a blob, or something to be converted to a blob plus its mime Content-type

function makeurl (blob,ct) {
	if (ct===undefined) ct="application/bin";
	if (toType(blob) == 'string') { //best to avoid binary strings or base64 as input
		//base64 url
		if(/^data:[^;]+;\s*base64\s*,/.test(blob)) {
			blob=b64toarray(blob.split(',')[1]);
		//assume binary string
		} else {
			blob=bstringtoarray(blob);
		}
	}
	if (toType(blob) != 'blob') { // tested only with uint8array and arraybuffer
		blob=new Blob ([blob],{type:ct});
	}
	return (URL.createObjectURL(blob));
}


(function($) {



function make64_async (blob, f) {
	var reader = new window.FileReader();
	reader.onload = function(event){
		f(event.target.result)
	}
	reader.readAsDataURL(blob);
}

function blobtoarray (blob, f) {
	var reader = new window.FileReader();
	reader.onload = function(event){
		f(event.target.result)
	}
	reader.readAsArrayBuffer(blob);
}

function blobtoarray (blob, f) {
	var reader = new window.FileReader();
	reader.onload = function(event){
		f(event.target.result)
	}
	reader.readAsBinaryString(blob);
}

function arraytob64url(a,ct){
	return "data:" + ct + ";base64," + arrayto64b(a);
}

function arrayto64b( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
       binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}

function b64toarray( b64 ) {
    var binary_string =  window.atob(b64);
    var len = binary_string.length;
    var bytes = new Uint8Array( len );
    for (var i = 0; i < len; i++)        {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
}

function bstringtoarray(s) {
	var bytes = new Uint8Array(s.length);
	for (var i=0; i<s.length; i++)
		bytes[i] = s.charCodeAt(i);
	return (bytes);
}


/*

callback (obj);
obj={
	event: e,
	fileData: see below,
	index: file index,
	// if maxConcurrentChunks is set and chunk is set
	dataChunks: array[] containing data chunks,
	currentDataChunk: index of the current data chunk in dataChunk[] from this read
}

fileData={
	files:arrayOfReadFiles[] FileList,
	file:currentFile File (includes file.type==mime content-type),
	index:currentIndex int,
	data: arraybuffer[] ArrayBuffer
	event: current event from .onload event;
	originalEvent: event from .on('change') event
}

*/

$.fn.fileread = function (cb,arg2,arg3){
   var defaults={
   	onFileLoad:           undefined,  //function called on each file load, or chunk
   	onAllLoad:            undefined,  //function called after all files loaded
   	dataType:             'uint8array', //arraybuffer, uint8array, binarystring, dataurl or text.
	chunk:                false ,
	onFinalChunk:         undefined,
	onStart:              undefined,
	maxConcurrentChunks:  1,         // max number of chunks per file to read at one time, if callback does something asynchronous with the data
					 // such as ajax upload.  Data will be in an array passed to onFileLoad() of maxConcurrentChunks length (dataChunks[],
					 // and index of current data is currentDataChunk).  Asynchronous function must delete dataChunks[currentDataChunk]
					 // after processing data to free up a slot.  After deleted, a new chunk of data will be loaded in its place and the
					 // onFileLoad callback will be called again.
					 // If callback synchronously handles data, then there is no need for this, and in effect it will be 1.

	maxConcurrentFiles:   1,         //max number of files to read concurrently

	waitfor:              undefined  //function that returns false if we need to wait before processing file, or true if we are ready
				         //onStart is called first, then this function must return true before file loading starts.
				         //if undefined, there is no wait.
   };
   var options, queued=0;


   if (typeof cb == 'object') {
   	options=$.extend({},defaults,cb);
   	this.data('fileread_options',options);
   } else if (typeof cb == 'string' ) {
   	var t=$(this[0]);
	if (!t) return;
	//I'm a conformist
	if (cb=='option') {
		cb=arg2;
		arg2=arg3;
	}

   	switch (cb) {
		// all files ever loaded by all objects in "this", not the FileList from the last load event
		case "files":
			var ret=[];
			this.each(function () {
				ret=ret.concat($(this).data('fileread'));
			});
			return ret;
		case "destroy":
			return this.each(function() {
				$(this).removeData('fileread');
				$(this).removeData('fileread_options');
				$(this).off('change');
			});
		case "onAllLoad":
		case "onFileLoad":
		case "onFinalChunk":
		case "onStart":
			if (typeof arg2=='function')
			  return this.each(function(){
				var opts=$(this).data('fileread_options')||options;
				opts[cb]=arg2;
				$(this).data('fileread_options',options);
			  });
			else {
			  var opts=t.data('fileread_options')||options;
			  return opts[cb];
			}
		case "dataType":
		case "chunk":
			if (arg2)
			  return this.each(function(){
				var opts=$(this).data('fileread_options',arg2)||options;
				opts[cb]=arg2;
				$(this).data('fileread_options',options);
			  });
			else {
			  var opts=t.data('fileread_options')||options;
			  return opts[cb];
			}
		default:
			return;
   	}
   } else if (typeof cb == 'function') {
   	options=defaults;
   	options.onFileLoad=cb;
   	options.onAllLoad=arg2;
   	this.data('fileread_options',options);
   }

   if (this && this[0] && toType(this[0])=='file') {
   	var t=this;
   	return {
   		exec: function(){
   			queueread(t,t,null);
   		}
   	}
   }

   return this.each(function(){
	$(this).on('change',function(oe){
		var files=oe.target.files;
		var elem=$(this);
		queueread(files,elem,oe);
	});
   });

   
   function queueread(files,elem,oe) {
   	var max=options.maxConcurrentFiles;
	if( !max || files.length < max) 
		doread(files,elem,oe);
	else {
		var cur=0;
		var si=setInterval(function () {
			//console.log("waiting "+ queued+'<'+max);
			while (queued < max) {
				//console.log("doread");
				doread(files,elem,oe,cur,cur+1);
				queued++;
				cur++;
			}
			if (cur==files.length)
				clearInterval(si);
		},100);
	} 
   }

   function doread(files,elem,oe,start,length) {
	var j=1;
	var opts=elem.data('fileread_options');
	if (!start) start=0;
	if (!length) length=files.length;
	
	for (var i = start; i < length; i++) {
		var chunksize=false,
		    reader = new FileReader();
		
		if (typeof opts.onStart=="function")
			opts.onStart.call(elem,{file:files[i],files: files, index: i});
		
		if (opts.chunk && files[i].size > opts.chunk ) 
			chunksize=opts.chunk; 

		function setreadertype(reader) {
			switch (opts.dataType) {
				case 'binarystring':
					reader.read=reader.readAsBinaryString;
					break;
				case 'dataurl':
					reader.read=reader.readAsDataURL;
					break;
				case 'text':
					reader.read=reader.readAsText;
					break;
				default:
					reader.read=reader.readAsArrayBuffer;
					break;
			}
		}
		
		setreadertype(reader);
		
		// this immediately executed anonymous function puts the current iteration 
		// of files[i] into our callback function that actually does the work.  
		// otherwise i and this loop  would be long finished by the time reader.onload was executed.
		reader.onload=( function( file, i, chunksize ) {
			return function loader (e) {
			   var fdata, elemdata=elem.data('fileread')||[];
			   var start, len, data=e.target.result, currentDataChunk,maxcon=opts.maxConcurrentChunks;
			   
			   if (toType(e.target.result)=='arraybuffer') 
				len=data.byteLength;
			   else 
				len=data.length;

			   if (opts.dataType=='uint8array')
				data=new Uint8Array(data);

			   if (!elemdata[i])
			      elemdata[i]=
			      {
				files: files,
				file: file,
				index:i,
				event: e,
				originalEvent: oe,
				chunkindex:-1,
				read: 0
			      }
			   if(chunksize!==false) {
				elemdata[i].chunkindex++;
				// if limiting to a maximum number of data chunks in memory at one time (via opts.maxConcurrentChunks)
				// then put data into an array with maximum number of members of array limited to opts.maxConcurrentChunks
				if (maxcon && typeof maxcon=='number') {
					if (typeof elemdata[i].data != 'array') {
						elemdata[i].data=[];
					}
					//find first empty slot
					for (var k=0;k<maxcon;k++) {
						if (!elemdata[i].data[k]) {
							elemdata[i].data[k]=data;
							currentDataChunk=k;
							break;
						}
					}
				}
				else elemdata[i].data=data;
			   }
			   else elemdata[i].data=data;

			   //save our start position
			   start=elemdata[i].read;

			   //set our start position for next round
			   elemdata[i].read+=data.length;

			   //update the data and attach it to our element
			   elem.data('fileread',elemdata);

			   // do our callback now that we have the file, or chunk of the file
			   if (typeof opts.onFileLoad == 'function') {
				var cbopts= {
					event: e,
					fileData: elemdata[i],
					index: i,
					startPos: start
				}
				// give callback the array and current index of datachunks
				if (currentDataChunk!==undefined){
					cbopts.dataChunks=elemdata[i].data;
					cbopts.currentDataChunk=currentDataChunk;
				}
				//console.log(cbopts);
				
				opts.onFileLoad.call(elem,cbopts);
			   }

			   // do we have more data to read from file?
			   if (chunksize && file.size>elemdata[i].read) {
				//set up a new reader and grab next chunk of data from file
				var reader=new FileReader();
				setreadertype(reader);
				// TODO: check if the closure is necessary, and if it is, does it do what we want.
				reader.onload=(function(file,i,chuncksize) {
					return loader; //loader() is this function
				})(file,i,chunksize);

				// wait for data to be processed and nulled by any asynchronous events elsewhere
				// if opts.maxConcurrentChunks is set, a slot has to be cleared by setting fileData.data[i]=null
				if (maxcon && typeof maxcon=='number') {
					// if we have data, wait for it to be cleared
					var clear=false;
					for (var k=0;k<maxcon;k++)
						if (!elemdata[i].data[k]) {clear=true;break;}

					if(clear) {
						//console.log("data slot available on first try?");
						//a data slot is clear.
						reader.read( file.slice(elemdata[i].read, elemdata[i].read+chunksize) );
					} else {
						// wait for a data slot to clear
						var waitid=setInterval(function(){
							//console.log("waiting for data slot");
							for (var k=0;k<maxcon;k++) {
							        //console.log(elemdata[i].data[k]);
								if (!elemdata[i].data[k]) {
									// allow changes to elem.data('fileread') to be applied
									// if they are made while we waited.
									elemdata=elem.data('fileread');
									//console.log("got data slot, grabbing a new chunk at " + elemdata[i].read);
									clearInterval(waitid);
									reader.read( file.slice(elemdata[i].read, elemdata[i].read+chunksize) );
									break;
								}
								else if (elemdata[i].data[k]==-1) //error signal
									clearInterval(waitid);
							}
						},100);
					}
				}
				else reader.read( file.slice(elemdata[i].read, elemdata[i].read+chunksize) );

			   } else if (chunksize && typeof opts.onFinalChunk=='function') {
				// we have read entire file in one go and we have a callback function
				opts.onFinalChunk.call(elem,{event: e, fileData: elemdata[i], index: i});
			   }

			   // if we requested chunking, but didn't do it because file is smaller than chunk size
			   // still call onFinalChunk() if defined
			   if (opts.chunk && !chunksize &&  typeof opts.onFinalChunk=='function') {
				opts.onFinalChunk.call(elem,{event: e, fileData: elemdata[i]});
			   }

			   // at the last file to be read
			   // if chunking, allFileData will only contain the most recent chunks, not complete files
			   if (j==files.length && typeof opts.onAllLoad=='function') {
				if (opts.chunk) {
				   var tread=0,tsize=0;
				   // check if we are done with all files
				   for (var k=0; k<elemdata.length;k++ ) {
					tread+=elemdata[i].read;
					tsize+=elemdata[i].file.size;
				   }
				   if (tread==tsize)
					opts.onAllLoad.call(elem,{allFileData:elemdata});
				} else {	
				   opts.onAllLoad.call(elem,{allFileData: elemdata});
				}
			   }
			   
			   if( (chunksize && file.size==elemdata[i].read)|| !chunksize ) {
			   	j++;
			   	queued--;
			   }
			};
		})(files[i],i,chunksize);
		// end reader.onload()


		function doreader (reader,i) {
			if (!chunksize)
				reader.read(files[i]);
			else 
				reader.read ( files[i].slice(0,chunksize) );
		}
		
		if (typeof opts.waitFor=="function") {
		   (function(ind,reader) {
			if (opts.waitFor.call(elem,{index:ind})) 
				doreader(reader,ind);
			else {
				var waitid=setInterval(function(){
					if (opts.waitFor.call(elem,{index:ind})) {
						//console.log("waitFor finished, doing file read for file "+ ind);
						clearInterval(waitid);
						doreader(reader,ind);
					}
				},100);
			}
		    })(i,reader);
		} 
		
		else doreader(reader,i);
	}
   }
}

})(jQuery);
