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

	V 0.1 - initial version

	Description and usage:

	aescrypt-ww encrypts and decrypts aescrypt formatted files as a web worker using aescrypt.js and forge.js
	
	Requires aescrypt.js in "js/aescrypt.js" location relative to the webpage that
	includes this script.
	
	Requires forge.min.js ( http://digitalbazaar.com/forge/ ) in the same "js/" directory
	
	Usage example:
	
	var aesworker= new AesWorker();
	
	aesworker.encrypt(someArrayBuffer, "somepass"|['pass1','pass2',...], function (e,encrypted) { 
		//do something with encrypted.data or
		//report error from encrypted.error
		//original (if provided) or created Uint8Array is transferred back in encrypted.inputdata
	});
	
	aesworker.decrypt(someArrayBuffer, "somepass", function (e,plaintext) { 
		//do something with plaintext.data or
		//report error from plaintext.error
	});
	
	Support for additional passwords:

	aesworker.addPassword(someArrayBuffer, "somepass", 'newpass', function (e,encrypted) { 
		//do something with encrypted.data or
		//report error from encrypted.error
	});
	// takes array of passwords or array of ints 0-15 of password slots
	aesworker.delPassword(someArrayBuffer, "somepass", ['arrayof','passwordsto','delete']|[0,...0-16], function (e,encrypted) { 
		//do something with encrypted.data or
		//report error from encrypted.error
	});
	
	will take Uint8Array, ArrayBuffer, Blob, and if necessary, a String.  If string is large, be aware that there will
	be an extra copy of the data in memory for a short while.

	Usage for chunking:
	
	var chunker= new AesWorker();

	// chunk={
	//	data: Uint8Array(size), if any, if none, data will be undefined
	//	chunkindex: number, the index of this chunk of data, if we got one
	//	func: string, the function that called this callback [cd_start|ce_start|update|finish]
	//	error: string, either "" or "some error message", generally set at the beginning or end of decryption
	// }
	var mydata=[];
	var file;
	var callback=function (e,chunk) {
		// check errors when decrypting (i.e. bad password, corrupted file)
		// if (chunk.error != "") { do something about it }
		// assemble
		mydata[chunk.chunkindex]=chunk.data;
		// or do something with chunk.data here
		if (chunk.func=='finish') {
			//assemble chunks into a single Uint8Array
			file=chunker.joinarrays(mydata);
			//or do something else to finish
			
			//terminate here, after all data has been returned
			chunker.terminate();
			// or don't terminate, and reuse chunker for another file.
		}
	}

	chunker.chunkEncrypt(pass1,callback);
	
	or:
	var min = 4096; //wait until we have this much data built up before calling callback (except, of course end of file).
	chunker.chunkEncrypt(pass1,callback,min);
	
	// make some function or do something that grabs chunks of the file you want to encrypt/decrypt
	grabsomedata(opts, function (datachunk) {
		chunker.update(datachunk);
	});
	
	chunker.finish();
	//or chunker.finish(finisingcallback); if you need a separate function
	// terminate the webworker in the callback, not here
	
	// decrypting is the same except use chunker.chunkDecrypt().
	// Then use the same chunker.update(),chunker.finish() and chunker.terminate().

********************************************************************************** */
var AesWorker=function(callback){

	this.worker=new Worker('js/aescrypt.js');

	
	this.chunker=false;
	// not required here, but if set here and in functions below, this one will be overwritten and never used
	this.callback=callback;
	
	this.worker.onmessage= (function(self) {
		return function(e) {
			self.callback(e,e.data);
		}
	})(this);
		
}

AesWorker.prototype._toType = function(obj) {
  return ({}).toString.call(obj).match(/\s([a-zA-Z0-9]+)/)[1].toLowerCase();
}

AesWorker.prototype._stringToArray=function(s) {
	var a= new Uint8Array(s.length);
	for (var i=0; i<s.length;i++) 
		a[i]=s.charCodeAt(i);
	return a;
}

//hopefully our data is already an arraybuffer or a uint8array
//if a binary string, that requires copying.
AesWorker.prototype._convertdata=function(data) {
	switch (this._toType(data)) {
		case 'arraybuffer':
			return new Uint8Array(data);
		case 'uint8array':
			return data;
		case 'string':
			return this._stringToArray(data);
		default:
			//console.log("input file needs to be an arraybuffer or uint8array");
			//console.log("Type is " + this._toType(data));
			return;
	}
}

AesWorker.prototype._getarrayslength=function(arrays) {
	var len=0;
	for (var i=0;i<arrays.length;i++)
		len+=arrays[i].length;
	return len;
}

AesWorker.prototype._sendmessage=function(func,pass,newpass,data,requirepass,size) {
	var d=new Date(), mess;
	var messageid=""+d.getTime()+""+Math.floor((Math.random() * 100) + 1);

	mess={	func: func, password: pass, newpassword: newpass, 
		data: data, requirepass: requirepass, messageid: messageid, size: size
	     };
//console.log(mess);
	if (mess.data)
		this.worker.postMessage(mess,[mess.data.buffer]);
	else
		this.worker.postMessage(mess);

}

AesWorker.prototype._messageworker=function(func,pass,newpass,data,requirepass,size) {
	if (this._toType(data)=='blob') {
		var r=new FileReader(),t=this;
		r.onload=function(e){
			 t._sendmessage (func, pass, '', new Uint8Array(e.target.result), requirepass,size);
		}
		r.readAsArrayBuffer(data);
	} else {
		this._sendmessage (func, pass, '', this._convertdata(data), requirepass, size);
	}
}

// TODO: something intelligent regarding return undefined on error
AesWorker.prototype.encrypt=function(data,pass,slotn,callback) {
	if (typeof callback != 'function') {
		if (typeof slotn == 'function') {
			this.callback=slotn;
		} else if (typeof this.callback != 'function') {
			// we have to have a callback to get data
			// so if not getting data, why do anything?
			return;
		}
	}
	else this.callback=callback;

	this._messageworker ('encrypt', pass, '', data);
	return this;
}

AesWorker.prototype.decrypt= function(data,pass,callback) {
	if (typeof callback != 'function'){
		if (typeof this.callback != 'function')
			return;
	}
	else this.callback=callback;

	this._messageworker ('decrypt', pass, '', data);
	return this;
}

AesWorker.prototype.addPassword= function(data,pass,newpass,callback) {
	if (typeof callback != 'function'){
		if (typeof this.callback != 'function')
			return;
	}
	else this.callback=callback;
	this._messageworker ('addpass', pass, newpass, data);
	return this;
}

AesWorker.prototype.delPassword= function(data,pass,newpass,callback,requirepass) {
	if (typeof callback != 'function'){
		if (typeof this.callback != 'function')
			return;
	}
	else this.callback=callback;
	this._messageworker ('delpass', pass, newpass, data, requirepass);
	return this;
}


/* functions for chunking data */
/* size is the minimum amount of data to provide callback, unless finish() */
AesWorker.prototype.chunkEncrypt= function(pass,callback,size) {
	// setting up another midstream would be bad
	if(this.chunker)
		return;
	if (typeof callback != 'function'){
		if (typeof this.callback != 'function')
			return;
	}
	else this.callback=callback;
	this._messageworker ('ce_start', pass, '', '',false,size)
	this.chunker=true;
	return this;
}

AesWorker.prototype.chunkDecrypt= function(pass,callback,size) {
	// setting up another midstream would be bad, mkay
	if(this.chunker)
		return;
	if (typeof callback != 'function'){
		if (typeof this.callback != 'function')
			return;
	}
	else this.callback=callback;
	this._messageworker ('cd_start', pass, '', '',false,size);
	this.chunker=true;
	return this;
},

AesWorker.prototype.update= function(data,size) {
	if(!this.chunker)
		return; //TODO: add error message

	if (!data || data.length==0)
		return this;

	this._messageworker ('update', '', '', data,false,size);
	return this;
}

AesWorker.prototype.finish=function () {
	if(!this.chunker)
		return; //TODO: add error message

	this._messageworker ('finish', '', '', '');
	this.chunker=false;
	return this;
}

AesWorker.prototype.terminate= function() {
	this.worker.terminate();
	return this;
};

AesWorker.prototype.joinarrays=function (arrays) {
	var len=this._getarrayslength(arrays), ret=new Uint8Array(len);
	
	if (len == 0) return;
	len=0;
	for (var i=0;i<arrays.length;i++){
		ret.set(arrays[i],len);
		len+=arrays[i].length;
	}
	
	return ret;
}
