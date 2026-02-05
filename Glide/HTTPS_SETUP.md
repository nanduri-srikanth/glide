# Local HTTPS Setup for Development

## Why HTTPS in Development?

Glide enforces HTTPS in debug mode to protect credentials from man-in-the-middle attacks on local networks. Even during development, authentication tokens and passwords should never be transmitted over unencrypted HTTP.

## Setting Up Local HTTPS with Self-Signed Certificate

### Option 1: Using Python (FastAPI/Flask)

If your backend uses Python FastAPI or Flask:

1. **Generate a self-signed certificate:**

```bash
# Generate certificate and private key
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Or with specific subject for localhost
openssl req -x509 -newkey rsa:4096 \
  -keyout key.pem \
  -out cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=localhost"
```

2. **Update your backend server to use HTTPS:**

For FastAPI:
```python
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="localhost",
        port=8000,
        ssl_keyfile="key.pem",
        ssl_certfile="cert.pem",
        reload=True
    )
```

For Flask:
```python
from flask import Flask
import ssl

app = Flask(__name__)

context = ssl.SSLContext(ssl.PROTOCOL_TLSv1_2)
context.load_cert_chain('cert.pem', 'key.pem')

if __name__ == "__main__":
    app.run(
        host="localhost",
        port=8000,
        ssl_context=context,
        debug=True
    )
```

### Option 2: Using mkcert (Recommended for Development)

[mkcert](https://github.com/FiloSottile/mkcert) is a tool that creates locally-trusted certificates:

1. **Install mkcert:**

```bash
# macOS
brew install mkcert nss

# Linux
# See: https://github.com/FiloSottile/mkcert#installation

# Windows
choco install mkcert
```

2. **Create and install the local CA:**

```bash
mkcert -install
```

3. **Generate certificate for localhost:**

```bash
mkcert localhost 127.0.0.1 ::1
```

This creates `localhost+2.pem` (certificate) and `localhost+2-key.pem` (private key).

4. **Update your backend to use these certificates:**

For FastAPI:
```python
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="localhost",
        port=8000,
        ssl_keyfile="localhost+2-key.pem",
        ssl_certfile="localhost+2.pem",
        reload=True
    )
```

### Option 3: Using Node.js (Express)

If your backend uses Node.js:

1. **Generate self-signed certificate:**

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

2. **Update Express server:**

```javascript
const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(8000, () => {
  console.log('HTTPS server running on https://localhost:8000');
});
```

## Trusting Self-Signed Certificates in iOS Simulator

### Automatic Trust (mkcert)

If you use mkcert and have run `mkcert -install`, certificates are automatically trusted on the system, including iOS Simulator.

### Manual Trust (openssl-generated certificates)

For certificates generated with openssl:

1. **Add the certificate to your macOS keychain:**

```bash
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db cert.pem
```

2. **Enable the certificate:**

```bash
# In Keychain Access, find "localhost" and set "Trust" > "When using this certificate" to "Always Trust"
```

3. **Restart iOS Simulator** to pick up the new trust settings.

## Disabling SSL Validation (NOT RECOMMENDED)

⚠️ **WARNING:** Never disable SSL validation in production. Only use this for temporary debugging.

If you absolutely must disable SSL validation for debugging (not recommended):

In your APIService implementation, you can add:

```swift
// Only for debugging - DO NOT ship this code
#if DEBUG
let session = URLSession(
    configuration: .default,
    delegate: URLSessionPinningDelegateHelper(disablePinning: true),
    delegateQueue: nil
)
#endif
```

However, this defeats the entire purpose of HTTPS and should never be used.

## Verifying HTTPS is Working

1. **Start your backend with HTTPS:**
   ```bash
   # You should see: "Uvicorn running on https://localhost:8000"
   ```

2. **Test with curl:**
   ```bash
   curl -k https://localhost:8000/api/v1/health
   ```

3. **Run the iOS app in debug mode:**
   - Check Xcode console for successful HTTPS connections
   - Verify no "App Transport Security has blocked HTTP" errors

4. **Verify in app logs:**
   - Network requests should show `https://localhost:8000` in logs
   - No SSL/TLS errors should appear

## Troubleshooting

### Error: "The certificate for this server is invalid"

This means the self-signed certificate is not trusted.

**Solution:** Use mkcert (recommended) or manually add the certificate to your keychain.

### Error: "Cannot connect to server"

This might be a firewall or port issue.

**Solution:**
- Verify backend is running: `curl -k https://localhost:8000`
- Check port 8000 is not blocked by firewall
- Ensure backend is listening on `0.0.0.0` or `localhost`

### iOS Simulator doesn't trust certificate

**Solution:**
1. Quit iOS Simulator
2. Add certificate to macOS keychain: `security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db cert.pem`
3. Restart iOS Simulator

### NSAppTransportSecurity blocking HTTPS

The app's Info.plist should have:
```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
```

This is already configured correctly in `/ios/glide/Info.plist`.

## Production Checklist

Before deploying to production:

- [ ] Use valid SSL certificates from a trusted CA (Let's Encrypt, AWS Certificate Manager, etc.)
- [ ] Verify certificate chains are complete
- [ ] Enable HTTP Strict Transport Security (HSTS) headers on backend
- [ ] Remove any SSL validation bypass code
- [ ] Test certificate renewal process
- [ ] Monitor certificate expiration dates

## Additional Resources

- [Apple App Transport Security](https://developer.apple.com/documentation/security/preventing_insecure_network_connections)
- [Let's Encrypt](https://letsencrypt.org/) - Free SSL certificates for production
- [mkcert Documentation](https://github.com/FiloSottile/mkcert)
- [OWASP Transport Layer Protection](https://owasp.org/www-project-top-ten/)
