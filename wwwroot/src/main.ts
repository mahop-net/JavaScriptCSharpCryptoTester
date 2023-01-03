class JsonEncryptMessage {
    public key: string = "";
    public text: string = "";
    public iv: string = "";
}


async function getPublicKeyFromServer(): Promise<string> {
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

async function encrypt(): Promise<string> {
    try {
        const publicKey = await getPublicKeyFromServer();
        const payload = (document.getElementById("message") as HTMLInputElement)?.value;
        if (!payload) {
            const resultElement = document.getElementById("result");
            resultElement!.innerHTML = "Please enter a message!";
            return new Promise<string>(() => { return undefined; });
        }

        const cryptoKey = await crypto.subtle.importKey(
            "spki",
            EncodingUtils.base64StringToArray(publicKey),
            { name: "RSA-OAEP", hash: { name: "SHA-256" } },
            false,
            ["encrypt"]
        );

        const encryptedPayload: ArrayBuffer = await crypto.subtle.encrypt(
            {
                name: "RSA-OAEP"
            },
            cryptoKey,
            EncodingUtils.stringToUtf8Array(payload)
        );

        const encryptedPayloadBase64 = EncodingUtils.arrayToBase64String(new Uint8Array(encryptedPayload));
        return encryptedPayloadBase64;
    } catch (e) {
        logText("Error occurred" + e);
        console.log(e);
        return new Promise<string>(() => { return undefined; });
    }
}

// This function is getting a public Key from the server, encrypts the Text entered in the TextArea and sends the encrypted text to the server
// The server decrypts the message with its private key and send the clear Text message back
// So you can see, if the server was able to decrypt the message
async function doRunRsaDecryptTest() {
    //Clear Log
    logText(undefined);

    const resultElement = document.getElementById("result");
    resultElement!.innerHTML = "Starting...";
    logText("Starting...");

    const encryptedPayloadBase64 = await encrypt();
    if (!encryptedPayloadBase64) {
        logText("Error occurred");
        resultElement!.innerHTML = "Could not encrypt your Message. See console for more details...";
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
        resultElement!.innerHTML = "Error calling the server: " + response.status + " " + response.statusText;
        logText("Got Error response!");
        return;
    }

    const responseText = await response.text();

    resultElement!.innerHTML = "Success: Server responded: " + responseText;
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
    resultElement!.innerHTML = "Starting...";
    logText("Starting...");

    let keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]
    );

    const publicKey = keyPair.publicKey;
    const publicKeyExported = await window.crypto.subtle.exportKey("spki", publicKey);
    const message = new JsonEncryptMessage();
    message.key = EncodingUtils.arrayToBase64String(new Uint8Array(publicKeyExported));
    message.text = (document.getElementById("message") as HTMLInputElement)?.value;

    logText("Posting to decrypt message:<br/>" + message.text + "<br/>with key:<br/>" + message.key + "<br/>");

    const response = await fetch("https://localhost:7091/encrypt", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        referrerPolicy: "no-referrer",
        body: JSON.stringify(message),
    });

    logText("Got response...");
    if (!response.ok) {
        resultElement!.innerHTML = "Error calling the server: " + response.status + " " + response.statusText;
        logText("Got Error response!");
        return;
    }

    const responseText = await response.text();

    const textBytes = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, keyPair.privateKey, EncodingUtils.base64StringToArray(responseText));
    const text = EncodingUtils.utf8ArrayToString(new Uint8Array(textBytes));

    resultElement!.innerHTML = "Success: Server responded with decrypted text: " + text;
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
    resultElement!.innerHTML = "Starting...";
    logText("Starting...");

    //Get the public Key from the server
    const publicKey = await getPublicKeyFromServer();
    const publicCryptoKey = await crypto.subtle.importKey(
        "spki",
        EncodingUtils.base64StringToArray(publicKey),
        { name: "RSA-OAEP", hash: { name: "SHA-256" } },
        false,
        ["encrypt"]
    );

    //Generate a symmetric key
    const symmetricKey = await window.crypto.subtle.generateKey(
        {
            name: "AES-CBC",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
    const symmetricKeyBytes = await window.crypto.subtle.exportKey("raw", symmetricKey);

    //encrypt the symmetric key with the public key from the server
    const symmetricKeyEncrypted = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicCryptoKey,
        symmetricKeyBytes
    );

    //encrypt the text from the TextArea with the symmetric key
    const text = (document.getElementById("message") as HTMLInputElement)?.value;
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const textEncrypted = await window.crypto.subtle.encrypt(
        { name: "AES-CBC", iv: iv },
        symmetricKey,
        EncodingUtils.stringToUtf8Array(text)
    );

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
        resultElement!.innerHTML = "Error calling the server: " + response.status + " " + response.statusText;
        logText("Got Error response!");
        return;
    }

    const responseText = await response.text();
    logText("Got Success response with encrypted text:" + responseText);

    const textDecrypted = await window.crypto.subtle.decrypt(
        { name: "AES-CBC", iv: iv },
        symmetricKey,
        EncodingUtils.base64StringToArray(responseText)
    );

    let clearTextResponse = EncodingUtils.utf8ArrayToString(new Uint8Array(textDecrypted));
    logText("Got Success response with text:" + clearTextResponse);
    resultElement!.innerHTML = "Done...";
}

function logText(text: string | undefined) {
    const logElement = document.getElementById("log");
    if (!text) {
        logElement!.innerHTML = "";
    } else {
        logElement!.innerHTML += text + "<br/>";
    }
}


