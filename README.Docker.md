### Building and running your application

When you're ready, start your application by running:
`docker compose up --build`.

Your application will be available at http://localhost:80.

### Configuring File Locations

By default, the Docker setup expects:
- SSL certificates in `./ssl/` directory
- Environment file at `./env.local`

You can customize these paths using environment variables to match your system's file structure.

#### Method 1: Environment Variables

Set custom paths before running Docker Compose:

```bash
# Set custom paths
export SSL_PATH=/path/to/your/ssl/certificates
export ENV_FILE=/path/to/your/.env.local
docker compose up --build
```

#### Method 2: .env File Configuration

Create a `.env` file in the same directory as `compose.yaml`:

```bash
# .env file contents
SSL_PATH=/home/user/ssl
ENV_FILE=/home/user/config/.env.local
```

Then run normally:
```bash
docker compose up --build
```

#### File Structure Examples

**Default setup:**
```
neomir-hana-gateway/
├── ssl/
│   ├── server.key
│   └── server.cert
├── .env.local
├── compose.yaml
└── ...
```

**Custom paths example:**
```
/your/custom/path/
├── certificates/
│   ├── server.key
│   └── server.cert
└── config/
    └── .env.local
```

Then set: `SSL_PATH=/your/custom/path/certificates` and `ENV_FILE=/your/custom/path/config/.env.local`

### Environment File Setup

Your `.env.local` file should contain the required environment variables:

```
HTTP_PORT=80
HTTPS_PORT=443
DECRYPTION_KEY=your_32_byte_hex_key_here
DECRYPTION_IV=your_16_byte_hex_iv_here
```

**Important**: Generate your encryption keys using:
- DECRYPTION_KEY: [https://www.random.org/cgi-bin/randbyte?nbytes=32&format=h](https://www.random.org/cgi-bin/randbyte?nbytes=32&format=h)
- DECRYPTION_IV: [https://www.random.org/cgi-bin/randbyte?nbytes=16&format=h](https://www.random.org/cgi-bin/randbyte?nbytes=16&format=h)

### SSL Certificate Setup

**Optional but recommended for production:**

1. Create your SSL certificate directory (default: `./ssl/`)
2. Place your SSL files:
   - `server.key` - Your SSL private key
   - `server.cert` - Your SSL certificate

If SSL certificates are not found, the server will automatically run in HTTP-only mode.

### Docker Deployment Notes

- **Ports**: The container exposes both HTTP (80) and HTTPS (443) ports
- **SSL Fallback**: Server gracefully falls back to HTTP-only if SSL certificates are missing
- **File Permissions**: Ensure the Docker process can read your SSL certificates and environment files
- **Security**: Keep sensitive files (SSL keys, environment variables) outside the Docker image using volume mounts

### Deploying your application to the cloud

First, build your image, e.g.: `docker build -t myapp .`.
If your cloud uses a different CPU architecture than your development
machine (e.g., you are on a Mac M1 and your cloud provider is amd64),
you'll want to build the image for that platform, e.g.:
`docker build --platform=linux/amd64 -t myapp .`.

Then, push it to your registry, e.g. `docker push myregistry.com/myapp`.

Consult Docker's [getting started](https://docs.docker.com/go/get-started-sharing/)
docs for more detail on building and pushing.

### References
* [Docker's Node.js guide](https://docs.docker.com/language/nodejs/)