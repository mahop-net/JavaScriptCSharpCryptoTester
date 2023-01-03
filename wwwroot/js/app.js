"use strict";
// Encoding Helpers
// Array <-> Base64 and Utf8Encoded Byte Array <-> String
// Based on the Code from
// https://developer.mozilla.org/en-US/docs/Glossary/Base64
// But with changed function names and comments for better understanding and converted to TypeScript
class EncodingUtils {
    // -------------------------------------------------------------------------------------------------
    // Convert a Base64 String To an Uint8Array
    // -------------------------------------------------------------------------------------------------
    static base64StringToArray(base64, nBlocksSize) {
        const sB64Enc = base64.replace(/[^A-Za-z0-9+/]/g, ""); //Remove not allowed chars in base64 string
        const nInLen = sB64Enc.length;
        const nOutLen = nBlocksSize
            ? Math.ceil(((nInLen * 3 + 1) >> 2) / nBlocksSize) * nBlocksSize
            : (nInLen * 3 + 1) >> 2;
        const taBytes = new Uint8Array(nOutLen);
        let nMod3;
        let nMod4;
        let nUint24 = 0;
        let nOutIdx = 0;
        for (let nInIdx = 0; nInIdx < nInLen; nInIdx++) {
            nMod4 = nInIdx & 3;
            nUint24 |= EncodingUtils.b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << (6 * (3 - nMod4));
            if (nMod4 === 3 || nInLen - nInIdx === 1) {
                nMod3 = 0;
                while (nMod3 < 3 && nOutIdx < nOutLen) {
                    taBytes[nOutIdx] = (nUint24 >>> ((16 >>> nMod3) & 24)) & 255;
                    nMod3++;
                    nOutIdx++;
                }
                nUint24 = 0;
            }
        }
        return taBytes;
    }
    //Helper
    static b64ToUint6(nChr) {
        return nChr > 64 && nChr < 91
            ? nChr - 65
            : nChr > 96 && nChr < 123
                ? nChr - 71
                : nChr > 47 && nChr < 58
                    ? nChr + 4
                    : nChr === 43
                        ? 62
                        : nChr === 47
                            ? 63
                            : 0;
    }
    // -------------------------------------------------------------------------------------------------
    // Convert a Uint8Array to a Base64 String
    // -------------------------------------------------------------------------------------------------
    static arrayToBase64String(aBytes) {
        let nMod3 = 2;
        let sB64Enc = "";
        const nLen = aBytes.length;
        let nUint24 = 0;
        for (let nIdx = 0; nIdx < nLen; nIdx++) {
            nMod3 = nIdx % 3;
            if (nIdx > 0 && ((nIdx * 4) / 3) % 76 === 0) {
                sB64Enc += "\r\n";
            }
            nUint24 |= aBytes[nIdx] << ((16 >>> nMod3) & 24);
            if (nMod3 === 2 || aBytes.length - nIdx === 1) {
                sB64Enc += String.fromCodePoint(EncodingUtils.uint6ToB64((nUint24 >>> 18) & 63), EncodingUtils.uint6ToB64((nUint24 >>> 12) & 63), EncodingUtils.uint6ToB64((nUint24 >>> 6) & 63), EncodingUtils.uint6ToB64(nUint24 & 63));
                nUint24 = 0;
            }
        }
        return (sB64Enc.substr(0, sB64Enc.length - 2 + nMod3) +
            (nMod3 === 2 ? "" : nMod3 === 1 ? "=" : "=="));
    }
    //Helper
    static uint6ToB64(nUint6) {
        return nUint6 < 26
            ? nUint6 + 65
            : nUint6 < 52
                ? nUint6 + 71
                : nUint6 < 62
                    ? nUint6 - 4
                    : nUint6 === 62
                        ? 43
                        : nUint6 === 63
                            ? 47
                            : 65;
    }
    // -------------------------------------------------------------------------------------------------
    // Convert a Uint8Array with bytes in UTF8 Encoding to a string
    // -------------------------------------------------------------------------------------------------
    static utf8ArrayToString(aBytes) {
        let sView = "";
        let nPart;
        const nLen = aBytes.length;
        for (let nIdx = 0; nIdx < nLen; nIdx++) {
            nPart = aBytes[nIdx];
            sView += String.fromCodePoint(nPart > 251 && nPart < 254 && nIdx + 5 < nLen /* six bytes */
                ? /* (nPart - 252 << 30) may be not so safe in ECMAScript! So…: */
                    (nPart - 252) * 1073741824 +
                        ((aBytes[++nIdx] - 128) << 24) +
                        ((aBytes[++nIdx] - 128) << 18) +
                        ((aBytes[++nIdx] - 128) << 12) +
                        ((aBytes[++nIdx] - 128) << 6) +
                        aBytes[++nIdx] -
                        128
                : nPart > 247 && nPart < 252 && nIdx + 4 < nLen /* five bytes */
                    ? ((nPart - 248) << 24) +
                        ((aBytes[++nIdx] - 128) << 18) +
                        ((aBytes[++nIdx] - 128) << 12) +
                        ((aBytes[++nIdx] - 128) << 6) +
                        aBytes[++nIdx] -
                        128
                    : nPart > 239 && nPart < 248 && nIdx + 3 < nLen /* four bytes */
                        ? ((nPart - 240) << 18) +
                            ((aBytes[++nIdx] - 128) << 12) +
                            ((aBytes[++nIdx] - 128) << 6) +
                            aBytes[++nIdx] -
                            128
                        : nPart > 223 && nPart < 240 && nIdx + 2 < nLen /* three bytes */
                            ? ((nPart - 224) << 12) +
                                ((aBytes[++nIdx] - 128) << 6) +
                                aBytes[++nIdx] -
                                128
                            : nPart > 191 && nPart < 224 && nIdx + 1 < nLen /* two bytes */
                                ? ((nPart - 192) << 6) + aBytes[++nIdx] - 128
                                : /* nPart < 127 ? */ /* one byte */
                                    nPart);
        }
        return sView;
    }
    // -------------------------------------------------------------------------------------------------
    // Convert string to an Uint8Array in UTF8 Encoding
    // -------------------------------------------------------------------------------------------------
    static stringToUtf8Array(str) {
        let aBytes;
        let nChr;
        const nStrLen = str.length;
        let nArrLen = 0;
        /* mapping… */
        for (let nMapIdx = 0; nMapIdx < nStrLen; nMapIdx++) {
            nChr = str.codePointAt(nMapIdx);
            if (nChr >= 0x10000) {
                nMapIdx++;
            }
            nArrLen +=
                nChr < 0x80
                    ? 1
                    : nChr < 0x800
                        ? 2
                        : nChr < 0x10000
                            ? 3
                            : nChr < 0x200000
                                ? 4
                                : nChr < 0x4000000
                                    ? 5
                                    : 6;
        }
        aBytes = new Uint8Array(nArrLen);
        /* transcription… */
        let nIdx = 0;
        let nChrIdx = 0;
        while (nIdx < nArrLen) {
            nChr = str.codePointAt(nChrIdx);
            if (nChr < 128) {
                /* one byte */
                aBytes[nIdx++] = nChr;
            }
            else if (nChr < 0x800) {
                /* two bytes */
                aBytes[nIdx++] = 192 + (nChr >>> 6);
                aBytes[nIdx++] = 128 + (nChr & 63);
            }
            else if (nChr < 0x10000) {
                /* three bytes */
                aBytes[nIdx++] = 224 + (nChr >>> 12);
                aBytes[nIdx++] = 128 + ((nChr >>> 6) & 63);
                aBytes[nIdx++] = 128 + (nChr & 63);
            }
            else if (nChr < 0x200000) {
                /* four bytes */
                aBytes[nIdx++] = 240 + (nChr >>> 18);
                aBytes[nIdx++] = 128 + ((nChr >>> 12) & 63);
                aBytes[nIdx++] = 128 + ((nChr >>> 6) & 63);
                aBytes[nIdx++] = 128 + (nChr & 63);
                nChrIdx++;
            }
            else if (nChr < 0x4000000) {
                /* five bytes */
                aBytes[nIdx++] = 248 + (nChr >>> 24);
                aBytes[nIdx++] = 128 + ((nChr >>> 18) & 63);
                aBytes[nIdx++] = 128 + ((nChr >>> 12) & 63);
                aBytes[nIdx++] = 128 + ((nChr >>> 6) & 63);
                aBytes[nIdx++] = 128 + (nChr & 63);
                nChrIdx++;
            } /* if (nChr <= 0x7fffffff) */
            else {
                /* six bytes */
                aBytes[nIdx++] = 252 + (nChr >>> 30);
                aBytes[nIdx++] = 128 + ((nChr >>> 24) & 63);
                aBytes[nIdx++] = 128 + ((nChr >>> 18) & 63);
                aBytes[nIdx++] = 128 + ((nChr >>> 12) & 63);
                aBytes[nIdx++] = 128 + ((nChr >>> 6) & 63);
                aBytes[nIdx++] = 128 + (nChr & 63);
                nChrIdx++;
            }
            nChrIdx++;
        }
        return aBytes;
    }
}
class JsonEncryptMessage {
    constructor() {
        this.key = "";
        this.text = "";
        this.iv = "";
    }
}
async function getPublicKeyFromServer() {
    logText("Get public Key!");
    const response = await fetch("https://localhost:7091/getPublicKey");
    if (!response.ok) {
        logText("Got Error response!");
        return "Error occurred";
    }
    const publicKey = await response.text();
    logText("Got Public Key:<br/>" + publicKey + "<br/>");
    return publicKey;
}
async function encrypt() {
    try {
        const publicKey = await getPublicKeyFromServer();
        const payload = document.getElementById("message")?.value;
        if (!payload) {
            const resultElement = document.getElementById("result");
            resultElement.innerHTML = "Please enter a message!";
            return new Promise(() => { return undefined; });
        }
        const cryptoKey = await crypto.subtle.importKey("spki", EncodingUtils.base64StringToArray(publicKey), { name: "RSA-OAEP", hash: { name: "SHA-256" } }, false, ["encrypt"]);
        const encryptedPayload = await crypto.subtle.encrypt({
            name: "RSA-OAEP"
        }, cryptoKey, EncodingUtils.stringToUtf8Array(payload));
        const encryptedPayloadBase64 = EncodingUtils.arrayToBase64String(new Uint8Array(encryptedPayload));
        return encryptedPayloadBase64;
    }
    catch (e) {
        logText("Error occurred" + e);
        console.log(e);
        return new Promise(() => { return undefined; });
    }
}
// This function is getting a public Key from the server, encrypts the Text entered in the TextArea and sends the encrypted text to the server
// The server decrypts the message with its private key and send the clear Text message back
// So you can see, if the server was able to decrypt the message
async function doRunRsaDecryptTest() {
    //Clear Log
    logText(undefined);
    const resultElement = document.getElementById("result");
    resultElement.innerHTML = "Starting...";
    logText("Starting...");
    const encryptedPayloadBase64 = await encrypt();
    if (!encryptedPayloadBase64) {
        logText("Error occurred");
        resultElement.innerHTML = "Could not encrypt your Message. See console for more details...";
        return;
    }
    logText("Posting to decrypt message:<br/>" + encryptedPayloadBase64 + "<br/>");
    const response = await fetch("https://localhost:7091/decrypt", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        referrerPolicy: "no-referrer",
        body: '"' + encryptedPayloadBase64 + '"'
    });
    logText("Got response...");
    if (!response.ok) {
        resultElement.innerHTML = "Error calling the server: " + response.status + " " + response.statusText;
        logText("Got Error response!");
        return;
    }
    const responseText = await response.text();
    resultElement.innerHTML = "Success: Server responded: " + responseText;
    logText("Got success response: " + responseText);
}
// This function creates a public and private key and sends the public Key with a clear Text Message to the server
// The server encrypts the message with the public key and returns the encrypted message
// Than this function decrypts the message with the private key and shows the message in the log
// So you can see, if the js code is able to decrypt the message encrypted on the server
async function doRunRsaEncryptTest() {
    //Clear Log
    logText(undefined);
    const resultElement = document.getElementById("result");
    resultElement.innerHTML = "Starting...";
    logText("Starting...");
    let keyPair = await window.crypto.subtle.generateKey({
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
    }, true, ["encrypt", "decrypt"]);
    const publicKey = keyPair.publicKey;
    const publicKeyExported = await window.crypto.subtle.exportKey("spki", publicKey);
    const message = new JsonEncryptMessage();
    message.key = EncodingUtils.arrayToBase64String(new Uint8Array(publicKeyExported));
    message.text = document.getElementById("message")?.value;
    logText("Posting to decrypt message:<br/>" + message.text + "<br/>with key:<br/>" + message.key + "<br/>");
    const response = await fetch("https://localhost:7091/encrypt", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        referrerPolicy: "no-referrer",
        body: JSON.stringify(message),
    });
    logText("Got response...");
    if (!response.ok) {
        resultElement.innerHTML = "Error calling the server: " + response.status + " " + response.statusText;
        logText("Got Error response!");
        return;
    }
    const responseText = await response.text();
    const textBytes = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, keyPair.privateKey, EncodingUtils.base64StringToArray(responseText));
    const text = EncodingUtils.utf8ArrayToString(new Uint8Array(textBytes));
    resultElement.innerHTML = "Success: Server responded with decrypted text: " + text;
    logText("Encrypted response: " + responseText);
    logText("Decrypted response: " + text);
}
// This function gets a public key form the server, generates a symmetric key, encrypts the text of the TextArea with the symmetric key, encrypts the symmetric key with the public key of the server
// and sends both, the encrypted message and the encrypted symmetric key to the server
// the server decrypts the symmetric key with its private key and decrypts the text with the symmetric key and sends the text in clear text back to the client
// so you can check if the loop was correctly working
async function duRunAesTest() {
    //Clear Log
    logText(undefined);
    const resultElement = document.getElementById("result");
    resultElement.innerHTML = "Starting...";
    logText("Starting...");
    //Get the public Key from the server
    const publicKey = await getPublicKeyFromServer();
    const publicCryptoKey = await crypto.subtle.importKey("spki", EncodingUtils.base64StringToArray(publicKey), { name: "RSA-OAEP", hash: { name: "SHA-256" } }, false, ["encrypt"]);
    //Generate a symmetric key
    const symmetricKey = await window.crypto.subtle.generateKey({
        name: "AES-CBC",
        length: 256
    }, true, ["encrypt", "decrypt"]);
    const symmetricKeyBytes = await window.crypto.subtle.exportKey("raw", symmetricKey);
    //encrypt the symmetric key with the public key from the server
    const symmetricKeyEncrypted = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicCryptoKey, symmetricKeyBytes);
    //encrypt the text from the TextArea with the symmetric key
    const text = document.getElementById("message")?.value;
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const textEncrypted = await window.crypto.subtle.encrypt({ name: "AES-CBC", iv: iv }, symmetricKey, EncodingUtils.stringToUtf8Array(text));
    //post the encrypted symmetric key and the encrypted text to the server
    const message = new JsonEncryptMessage();
    message.key = EncodingUtils.arrayToBase64String(new Uint8Array(symmetricKeyEncrypted));
    message.text = EncodingUtils.arrayToBase64String(new Uint8Array(textEncrypted));
    message.iv = EncodingUtils.arrayToBase64String(iv);
    const response = await fetch("https://localhost:7091/aes", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        referrerPolicy: "no-referrer",
        body: JSON.stringify(message),
    });
    logText("Got response...");
    if (!response.ok) {
        resultElement.innerHTML = "Error calling the server: " + response.status + " " + response.statusText;
        logText("Got Error response!");
        return;
    }
    const responseText = await response.text();
    logText("Got Success response with encrypted text:" + responseText);
    const textDecrypted = await window.crypto.subtle.decrypt({ name: "AES-CBC", iv: iv }, symmetricKey, EncodingUtils.base64StringToArray(responseText));
    let clearTextResponse = EncodingUtils.utf8ArrayToString(new Uint8Array(textDecrypted));
    logText("Got Success response with text:" + clearTextResponse);
    resultElement.innerHTML = "Done...";
}
function logText(text) {
    const logElement = document.getElementById("log");
    if (!text) {
        logElement.innerHTML = "";
    }
    else {
        logElement.innerHTML += text + "<br/>";
    }
}
//# sourceMappingURL=app.js.map