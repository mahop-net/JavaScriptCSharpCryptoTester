# JavaScript <-> CSharp Crypto Tester
Just a little Testproject to show RSA and AES Crypto Interopt between vanillia JavaScript and C# using the crypto.subtle API on JS side and .Net 6/7 on the C# side

# This project has 3 functions
- RSA: Getting a public key from the server, encrypt a message in JS, and decrypt the message on the C# side
- RSA: Generate Keys in JS send public key to the server and encrypt message on the C# side and decrypt it in the JS side
- AES: 
  - get public RSA Key from the Server
  - generate AES key in JS and ancrypt a message in JS with AES
  - encrypt the AES Key with RSA public key
  - send encrypted AES key and encrypted Message to the server
  - on C# decrypt the AES key and than the message
  - on C# encrypt a message with the AES Key for JS
  - on JS side decrypt the message from the server

# Help wanted
If you see a mistake in using the crypto APIs (Js and/or .Net) please open an issue!!!

# Warning
Do NOT use this code in production unchanged. It's just a little test project!!!

# License
MIT
