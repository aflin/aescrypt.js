# aescrypt.js
Encryption and decryption of files in aescrypt 0.2 format in pure javascript

More about aescrypt can be found here: https://www.aescrypt.com/

The library can be used with or without web-workers.  THe web-worker version is recommended since the regular version is run in the main thread and can severely slow down the browser.

See the js/aescrypt-ww.js file for usage examples.

There are options to encrypt or decrypt one chunck at a time for large files which you may be sending to a remote server.  Example usage is in aes-chunk.html

Otherwise a simpler, encrypt all at once version is in aes-simple.html

