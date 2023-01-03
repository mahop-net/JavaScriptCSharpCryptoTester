using Microsoft.AspNetCore.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace JavaScriptToCsRsaCryptoTester {
    public class Program {
        private static readonly RSAEncryptionPadding _padding = RSAEncryptionPadding.OaepSHA256;
        private static byte[] _privateKey;

        public static void Main(string[] args) {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.
            builder.Services.AddAuthorization();
            var app = builder.Build();

            // Configure the HTTP request pipeline.

            app.UseHttpsRedirection();
            app.UseStaticFiles();

            app.UseAuthorization();

            app.MapGet("/", async c => await Task.Run(() => c.Response.Redirect("/index.html")));
            app.MapGet("/getPublicKey", async c => await c.Response.WriteAsync(GeneratePublicKeyAsBase64(c)));
            app.MapPost("/decrypt", async c => await c.Response.WriteAsync(await DecryptSecreteMessage(c)));
            app.MapPost("/encrypt", async c => await c.Response.WriteAsync(await EncryptMessage(c)));
            app.MapPost("/aes", async c => await c.Response.WriteAsync(await EncryptAesMessage(c)));

            app.Run();
        }

        private static async Task<string> EncryptAesMessage(HttpContext httpContext) {
            try {
                using var textReader = new StreamReader(httpContext.Request.Body);
                var jsonString = await textReader.ReadToEndAsync();
                var message = JsonSerializer.Deserialize<JsonEncryptMessage>(jsonString);
                if (message == null) {
                    return "No message found!";
                }

                using var rsa = RSA.Create();

                //read private key from the memory cache (NOT working in real live apps with multiple sessions!!!)
                rsa.ImportPkcs8PrivateKey(_privateKey, out _);

                //Decrypt the symmetric Key
                var encryptedKeyBytes = Convert.FromBase64String(message.key);
                var decryptedSymmetricKeyBytes = rsa.Decrypt(encryptedKeyBytes, _padding);

                // Use the symmetric Key to decrypt message
                var encryptedMessageBytes = Convert.FromBase64String(message.text);
                using var ms = new MemoryStream(encryptedMessageBytes);
                var iv = Convert.FromBase64String(message.iv);

                using var aes = Aes.Create();
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;
                var decryptor = aes.CreateDecryptor(decryptedSymmetricKeyBytes, iv);
                await using var cryptoStream = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
                using var ms2 = new MemoryStream();
                await cryptoStream.CopyToAsync(ms2);

                var decryptedMessageBytes = ms2.ToArray();
                var clearText = new UTF8Encoding().GetString(decryptedMessageBytes);

                //Add some chars to the message
                clearText += " - hello from Server";

                // Use the symmetric Key to encrypt the message again
                using var msClearText = new MemoryStream(new UTF8Encoding().GetBytes(clearText));
                var encryptor = aes.CreateEncryptor(decryptedSymmetricKeyBytes, iv);
                await using var cryptoStream2 = new CryptoStream(msClearText, encryptor, CryptoStreamMode.Read);
                using var ms3 = new MemoryStream();
                await cryptoStream2.CopyToAsync(ms3);

                return Convert.ToBase64String(ms3.ToArray());
            } catch (Exception ex) {
                return "Error..." + ex.Message;
            }
        }

        private static async Task<string> EncryptMessage(HttpContext httpContext) {
            try {
                using var textReader = new StreamReader(httpContext.Request.Body);
                var jsonString = await textReader.ReadToEndAsync();
                var message = JsonSerializer.Deserialize<JsonEncryptMessage>(jsonString);
                if (message == null) {
                    return "No message found!";
                }
                var publicKey = Convert.FromBase64String(message.key);

                using var rsa = RSA.Create();
                rsa.ImportSubjectPublicKeyInfo(publicKey, out _);
                var encryptedBytes = rsa.Encrypt(new UTF8Encoding().GetBytes(message.text), RSAEncryptionPadding.OaepSHA256);

                return Convert.ToBase64String(encryptedBytes);
            } catch (Exception ex) {
                return "Error..." + ex.Message;
            }
        }

        private static string GeneratePublicKeyAsBase64(HttpContext httpContext) {
            // This generate a new public/private key pair.  
            using var rsa = RSA.Create();

            //keep the private key in the memory cache -
            // This is NOT working in real live with multiple sessions running!!!!
            // => Store it with the UserData on the server somewhere in a Database or another save place...
            _privateKey = rsa.ExportPkcs8PrivateKey();

            //return the public key in X.509 (Base-64) format
            var publicKey = Convert.ToBase64String(rsa.ExportSubjectPublicKeyInfo());
            Console.WriteLine(publicKey);
            return publicKey;
        }

        private static async Task<string> DecryptSecreteMessage(HttpContext httpContext) {
            using var textReader = new StreamReader(httpContext.Request.Body);
            var encryptedPayloadBase64 = await textReader.ReadToEndAsync();
            encryptedPayloadBase64 = encryptedPayloadBase64.Replace("\"", string.Empty);
            if (string.IsNullOrWhiteSpace(encryptedPayloadBase64)) {
                return "No Message found!";
            }

            using var rsa = RSA.Create();

            //read private key from the memory cache (NOT working in real live apps with multiple sessions!!!)
            rsa.ImportPkcs8PrivateKey(_privateKey, out _);

            //use the private key to decrypt the payload
            var encryptedPayload = Convert.FromBase64String(encryptedPayloadBase64);
            var decryptedPayload = rsa.Decrypt(encryptedPayload, _padding);
            var payload = (new UTF8Encoding()).GetString(decryptedPayload);
            return payload;
        }


    }

    internal class JsonEncryptMessage {
        public string key { get; set; }
        public string text { get; set; }
        public string iv { get; set; }
    }
}